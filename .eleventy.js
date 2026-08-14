const path = require("path");

// Tags can be written as "one-tag" or "tag one, tag two" (comma-separated).
// This always returns a clean array either way.
function normalizeTags(tagsData) {
  if (!tagsData) return [];
  if (Array.isArray(tagsData)) {
    return tagsData.map((t) => String(t).trim()).filter(Boolean);
  }
  return String(tagsData)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Maps a post's `kind` to the tag name that just restates its own section
// (e.g. a box post tagged "boxes") — that tag is redundant wherever the
// post already shows its section via breadcrumb/nav, but the same word
// used on a post of a DIFFERENT kind (like "lyrics" on a box post) is a
// real, meaningful cross-cutting tag and should be treated normally.
const SECTION_TAG_BY_KIND = { poem: "poems", lyric: "lyrics", story: "stories", box: "boxes" };

// Turns a tag like "deep thoughts" into a URL-safe "deep-thoughts"
function slugifyTag(tag) {
  return String(tag)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Looks up the most recent git commit date that touched a given file, so
// "Activity" can reflect when something was actually added/edited in the
// archive rather than the narrative date written in its front matter.
const { execSync } = require("child_process");
function getLastCommitDate(inputPath) {
  try {
    const out = execSync(`git log -1 --format=%aI -- "${inputPath}"`, {
      encoding: "utf8",
    }).trim();
    return out ? new Date(out) : null;
  } catch (e) {
    return null;
  }
}

// Pulls the video ID out of any common YouTube URL shape (youtu.be share
// links, full youtube.com/watch links, already-an-embed links, or a bare
// ID), so front matter can just hold whatever URL got copied from YouTube.
function youtubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/watch\?(?:.*&)?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/,
  ];
  for (const pattern of patterns) {
    const match = String(url).match(pattern);
    if (match) return match[1];
  }
  return String(url).trim(); // assume it's already a bare video ID
}

// Plain-text version of a post's full rendered content, used for the search
// index. No truncation — search needs to match words anywhere in a post,
// not just its opening lines, no matter how long the post is.
function searchExcerpt(content) {
  return String(content || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = function (eleventyConfig) {
  // Copy static assets straight through to the output folder
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/files");

  // Files in src/files (like the Magician's Ledger) are plain downloadable
  // documents, not pages — don't let Eleventy try to template-process them.
  eleventyConfig.ignores.add("src/files/**");

  eleventyConfig.addFilter("tagSlug", slugifyTag);
  eleventyConfig.addFilter("searchExcerpt", searchExcerpt);
  eleventyConfig.addFilter("youtubeId", youtubeId);

  // Displays a post's kind as a label. Every kind but "lyric" reads fine
  // singular (poem, story, box — each names the one post in front of you),
  // but "lyric" reads oddly next to a single song and should say "lyrics"
  // instead. Front matter itself stays singular (kind: lyric) since that's
  // what section lookups, collections, and tag logic key off of.
  eleventyConfig.addFilter("kindLabel", (kind) => (kind === "lyric" ? "lyrics" : kind));

  // Filters a list of entries down to only those carrying a given tag
  eleventyConfig.addFilter("withTag", (items, tag) => {
    return (items || []).filter((item) => normalizeTags(item.data.tags).includes(tag));
  });

  // A post's tags, minus the one tag that just restates its own section
  // (e.g. a box post tagged "boxes") — that's shown via the breadcrumb
  // already, so it'd be redundant as a chip. A tag like "lyrics" on a box
  // or story post is a real, meaningful topical tag (the post happens to
  // contain song lyrics) and should still show up as a chip.
  eleventyConfig.addFilter("extraTags", (tagsData, kind) => {
    const ownSectionTag = SECTION_TAG_BY_KIND[kind];
    return normalizeTags(tagsData).filter((t) => t !== ownSectionTag);
  });

  // All of a post's tags (including kind), space-joined, so the search
  // index can match on tags too, not just title/body text.
  eleventyConfig.addFilter("tagsSearchString", (tagsData) => {
    return normalizeTags(tagsData).join(" ");
  });

  // Picks the most-recently-dated featured entry of one specific kind
  // (poem/lyric/story/box), for that category page's own featured spot.
  eleventyConfig.addFilter("featuredForKind", (items, kind) => {
    return (items || []).find((item) => item.data.kind === kind) || null;
  });

  // Picks which featured post shows on the homepage. Normally that's just
  // the newest one (items[0], since the list is already date-sorted). But
  // if any featured post is also marked `spotlight: true`, it wins instead
  // — this lets an older post be pinned to the homepage without having to
  // fake its date to make it look newer than everything else.
  eleventyConfig.addFilter("homeSpotlight", (items) => {
    if (!items || !items.length) return null;
    return items.find((item) => item.data.spotlight) || items[0];
  });

  // Sorts a list of entries alphabetically by title (case-insensitive).
  // Used on the Invocations (lyrics) index — with 150+ songs, alphabetical
  // is easier to scan for a specific title than newest-first.
  eleventyConfig.addFilter("sortByTitle", (items) => {
    return [...(items || [])].sort((a, b) =>
      String(a.data.title || "").localeCompare(String(b.data.title || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      })
    );
  });

  // Nice readable date filter, e.g. "July 19, 2026"
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  });

  // Combined, newest-first feed across every content type
  eleventyConfig.addCollection("everything", (collectionApi) => {
    return collectionApi
      .getAll()
      .filter((item) => item.data.kind)
      .sort((a, b) => b.date - a.date);
  });

  // Live per-kind counts for the About page's tally section. Keyed off
  // `kind` (poem/lyric/story/box) rather than tags, so it can't drift out
  // of sync with what's actually on the site even if a post's tags don't
  // happen to include its own section word.
  eleventyConfig.addCollection("kindCounts", (collectionApi) => {
    const counts = { poem: 0, lyric: 0, story: 0, box: 0 };
    collectionApi.getAll().forEach((item) => {
      if (item.data.kind in counts) counts[item.data.kind]++;
    });
    counts.total = counts.poem + counts.lyric + counts.story + counts.box;
    return counts;
  });

  // Whichever post(s) have `featured: true` in their front matter, newest
  // (by its own date) first. The homepage shows whichever one wins via the
  // homeSpotlight filter (newest, unless one is marked `spotlight: true`).
  eleventyConfig.addCollection("featured", (collectionApi) => {
    return collectionApi
      .getAll()
      .filter((item) => item.data.kind && item.data.featured)
      .sort((a, b) => b.date - a.date);
  });

  // The 10 most recently added/edited entries, based on git commit history
  // per file — not the narrative "date" written in the post itself.
  eleventyConfig.addCollection("activity", (collectionApi) => {
    const items = collectionApi.getAll().filter((item) => item.data.kind);
    const withDates = items.map((item) => ({
      item,
      modified: getLastCommitDate(item.inputPath) || item.date,
    }));
    withDates.sort((a, b) => b.modified - a.modified);
    return withDates.slice(0, 10);
  });

  // Every distinct topic tag used across all entries, excluding each
  // post's own redundant section tag (a box post tagged "boxes") — but a
  // section word used as a real cross-cutting tag on a DIFFERENT kind of
  // post (like "lyrics" on a box post) still gets its own /tags/ page.
  eleventyConfig.addCollection("tagList", (collectionApi) => {
    const tagSet = new Set();
    collectionApi.getAll().forEach((item) => {
      if (!item.data.kind) return;
      const ownSectionTag = SECTION_TAG_BY_KIND[item.data.kind];
      normalizeTags(item.data.tags).forEach((tag) => {
        if (tag !== ownSectionTag) tagSet.add(tag);
      });
    });
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  });

  // When this site is built for GitHub Pages, it lives at a sub-address
  // (yourname.github.io/lab-letters/) rather than the domain root. The
  // build command passes --pathprefix to set that here; locally it's
  // left blank so `npm start` keeps working at plain localhost:8080.
  // This transform makes sure image paths written in Markdown (e.g.
  // /images/photo.jpg) still resolve correctly either way, without you
  // ever needing to think about it when writing a new entry.
  eleventyConfig.addTransform("prefixImagePaths", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      const prefix = eleventyConfig.pathPrefix;
      if (prefix && prefix !== "/") {
        const clean = prefix.endsWith("/") ? prefix : prefix + "/";
        return content.replace(/(src|href)="\/images\//g, `$1="${clean}images/`);
      }
    }
    return content;
  });

  // Any external (http/https) link written anywhere in a post's Markdown
  // automatically opens in a new tab — no need to write raw HTML or
  // remember target="_blank" yourself. Internal site links (which always
  // start with "/") are left alone and navigate normally. Links that
  // already specify their own target (like the About/Magic page links)
  // are skipped so they aren't touched twice.
  eleventyConfig.addTransform("externalLinksNewTab", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      return content.replace(
        /<a\s+href="(https?:\/\/[^"]+)"(?![^>]*target=)/g,
        '<a href="$1" target="_blank" rel="noopener"'
      );
    }
    return content;
  });

  // After every build, generate a downloadable PDF and EPUB for every
  // poem, lyric, story, and box, sitting right next to that post's own
  // page in _site (e.g. /stories/meeting-bowie/story.pdf). Nothing to
  // remember when adding a new post — this just runs every time.
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const generateReaderFiles = require("./scripts/generate-reader-files.js");
    const count = await generateReaderFiles(dir.output);
    console.log(`[reader-files] generated PDF + EPUB for ${count} posts`);
  });

  // Also after every build, scan the source markdown for the
  // lyric-block/poem-block blank-line bug (see scripts/check-lyric-blocks.js)
  // and fail the build if it's back, instead of letting broken formatting
  // reach GitHub Pages unnoticed.
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const checkLyricBlocks = require("./scripts/check-lyric-blocks.js");
    const problems = checkLyricBlocks(path.join(__dirname, dir.input));
    if (problems.length) {
      console.error(`\n[check-lyric-blocks] ${problems.length} broken lyric-block/poem-block div(s) found:`);
      problems.forEach((p) => console.error(`  - ${p.file}`));
      console.error(`Run "node scripts/check-lyric-blocks.js" for details on each one.\n`);
      process.exitCode = 1;
    } else {
      console.log("[check-lyric-blocks] all lyric-block/poem-block divs OK");
    }
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    // Write dates and titles in Markdown, HTML in templates
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
