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

module.exports = function (eleventyConfig) {
  // Copy static assets straight through to the output folder
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");

  eleventyConfig.addFilter("tagSlug", slugifyTag);

  // Filters a list of entries down to only those carrying a given tag
  eleventyConfig.addFilter("withTag", (items, tag) => {
    return (items || []).filter((item) => normalizeTags(item.data.tags).includes(tag));
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
