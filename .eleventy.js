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
// index. No meaningful truncation — search needs to match words anywhere in
// a post, not just its opening lines.
function searchExcerpt(content) {
  const text = String(content || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 20000 ? text.slice(0, 20000) : text;
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

  // Filters a list of entries down to only those carrying a given tag
  eleventyConfig.addFilter("withTag", (items, tag) => {
    return (items || []).filter((item) => normalizeTags(item.data.tags).includes(tag));
  });

  // A post's tags, minus the four built-in kind names — these are the
  // "extra" descriptive tags (like New York, Zabar's) shown as chips at
  // the bottom of each post.
  eleventyConfig.addFilter("extraTags", (tagsData) => {
    const kindNames = ["poems", "lyrics", "stories", "boxes"];
    return normalizeTags(tagsData).filter((t) => !kindNames.includes(t));
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

  // Every distinct topic tag used across all entries, excluding the four
  // built-in kind categories (poems/lyrics/stories/boxes) since those
  // already have their own nav links and section pages.
  eleventyConfig.addCollection("tagList", (collectionApi) => {
    const kindNames = ["poems", "lyrics", "stories", "boxes"];
    const tagSet = new Set();
    collectionApi.getAll().forEach((item) => {
      if (!item.data.kind) return;
      normalizeTags(item.data.tags).forEach((tag) => {
        if (!kindNames.includes(tag)) tagSet.add(tag);
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
