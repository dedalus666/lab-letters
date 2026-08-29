// Safety net for a bug that's bitten this site before: a blank line
// written *inside* a `<div class="lyric-block">...</div>` (or
// `poem-block`, or `verse-quote` — the wrapper used to quote a verse/
// lyric/soliloquy inside an otherwise prose story or box post) makes
// markdown-it treat the div as a raw HTML block that terminates at that
// blank line — CommonMark's rule, not a bug in this site's code.
// Everything after the blank line then falls OUTSIDE the div as an
// auto-wrapped sibling <p>, losing the pre-wrap/serif/italic styling,
// with its quote marks HTML-escaped.
//
// The site no longer needs the lyric-block/poem-block wrapper at all —
// plain markdown paragraphs get the same styling automatically now (see
// .post-body-lyric/.post-body-poem in style.css) — but old posts still
// use the manual div, and it's easy to reintroduce a blank line while
// hand-editing one.
//
// This checks the SOURCE markdown directly rather than the built HTML.
// An earlier version scanned _site output instead and threw false
// positives on posts that legitimately have other content after the
// div (a Bandcamp link, a prose tribute) — there's no reliable way to
// tell "leaked lyric text" from "intentional paragraph" after the fact
// in the output. Checking the source for the actual root cause (a
// blank/whitespace-only line between a div's open and close tag) is
// unambiguous and has no such false positives.
//
// Runs automatically after every build (wired up in .eleventy.js via the
// "eleventy.after" event) — nothing to remember.

const fs = require("fs");
const path = require("path");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
}

function checkLyricBlocks(srcDir) {
  const files = [];
  walk(srcDir, files);

  const problems = [];
  for (const file of files) {
    // Strip HTML comments first — a comment showing someone the
    // verse-quote/lyric-block syntax as documentation (see
    // example-story.md) isn't a real div and shouldn't be checked as one.
    const text = fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    const blockPattern = /<div class="(lyric-block|poem-block|verse-quote)">([\s\S]*?)<\/div>/g;
    let match;
    while ((match = blockPattern.exec(text))) {
      const [, className, inner] = match;
      const lines = inner.split("\n");
      // The line right after "<div ...>" and right before "</div>" is
      // always empty (the tags sit on their own lines) — that's just
      // formatting, not a blank line inside the actual content, so drop
      // exactly one from each end before checking what's left.
      if (lines[0] === "") lines.shift();
      if (lines[lines.length - 1] === "") lines.pop();
      const blankLineIndex = lines.findIndex((line) => line.trim() === "");
      if (blankLineIndex !== -1) {
        const before = lines[blankLineIndex - 1] || "";
        const after = lines[blankLineIndex + 1] || "";
        problems.push({
          file,
          className,
          snippet: `"${before.trim()}" [blank line] "${after.trim()}"`,
        });
      }
    }
  }

  return problems;
}

module.exports = checkLyricBlocks;

if (require.main === module) {
  const srcDir = process.argv[2] || path.join(__dirname, "..", "src");
  const problems = checkLyricBlocks(srcDir);
  if (problems.length) {
    console.error(`\n[check-lyric-blocks] found a blank line inside ${problems.length} .lyric-block/.poem-block/.verse-quote div(s):\n`);
    problems.forEach((p) => {
      console.error(`  ${path.relative(process.cwd(), p.file)}`);
      console.error(`    ${p.snippet}`);
      console.error(`    fix: put a <br> at the end of the line before the blank line, don't leave the line itself blank\n`);
    });
    process.exitCode = 1;
  } else {
    console.log("[check-lyric-blocks] all lyric-block/poem-block/verse-quote divs OK");
  }
}
