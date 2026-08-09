// Generates a downloadable PDF and EPUB for every poem, lyric, story, and
// box post, sitting right alongside that post's own page in _site. Runs
// automatically after every build (wired up in .eleventy.js via the
// "eleventy.after" event) — nothing to remember when adding a new post.
//
// Deliberately uses pure-JS libraries (pdfkit, epub-gen-memory) instead of
// a headless browser, so this works the same locally and in GitHub Actions
// without needing to download/install a browser binary.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const matter = require("gray-matter");
const MarkdownIt = require("markdown-it");
const PDFDocument = require("pdfkit");
const genEpub = require("epub-gen-memory").default;

const md = new MarkdownIt({ html: false, breaks: false });
// markdown-it blocks file:// links/images by default as an untrusted-input
// safeguard. We generate this content ourselves from our own local photos,
// so it's safe to allow here — without this, embedded images silently
// fail to render at all (the markdown is left as literal text instead).
md.validateLink = () => true;
const IMAGES_DIR = path.resolve("src/images");

const SECTIONS = [
  { dir: "src/poems", url: "/poems/" },
  { dir: "src/lyrics", url: "/lyrics/" },
  { dir: "src/stories", url: "/stories/" },
  { dir: "src/boxes", url: "/boxes/" },
];

function readableDate(dateValue) {
  return new Date(dateValue).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Turns a plain filename ("hecate1.jpeg") or a site-relative path
// ("/images/hecate1.jpeg") into a file:// URL pointing straight at the
// source image on disk, so epub-gen-memory can embed it without needing
// network access or the site to be built/deployed anywhere first.
function imageFileUrl(filenameOrPath) {
  const filename = filenameOrPath.replace(/^\/images\//, "");
  return pathToFileURL(path.join(IMAGES_DIR, filename)).href;
}

// Strips image markdown and simplifies links down to their visible text.
// Used for the PDF, which stays text-only — laying out photos well on a
// generated PDF page is a fair bit more work than an EPUB, which is just
// a package of HTML.
function toPlainMarkdown(content) {
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// Rewrites any inline `/images/...` references in the post's own Markdown
// body to file:// URLs, so a single-photo post's `![caption](/images/x.jpg)`
// embeds correctly in the EPUB.
function embedInlineImages(content) {
  return content.replace(/(!\[[^\]]*\]\()\/images\/([^)]+)(\))/g, (match, open, filename, close) => {
    return open + imageFileUrl(filename) + close;
  });
}

async function generatePdf(outputPath, { title, kind, date }, plainMarkdown) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 64, size: "LETTER" });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.font("Times-Bold").fontSize(24).text(title);
    doc.moveDown(0.25);
    doc
      .font("Times-Roman")
      .fontSize(11)
      .fillColor("#666666")
      .text([kind, readableDate(date)].filter(Boolean).join("  ·  "));
    doc.moveDown(1.25);
    doc.fillColor("#000000").font("Times-Roman").fontSize(13);

    plainMarkdown
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((paragraph, i) => {
        if (i > 0) doc.moveDown(0.75);
        doc.text(paragraph, { align: "left", lineGap: 4 });
      });

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function generateEpub(outputPath, { title, kind, date, gallery }, content) {
  const galleryHtml =
    gallery && gallery.length
      ? gallery.map((filename) => `<img src="${imageFileUrl(filename)}" alt="" />`).join("\n") + "\n"
      : "";
  const bodyHtml = md.render(embedInlineImages(content));

  const buffer = await genEpub(
    {
      title,
      author: "Dedalus",
      description: [kind, readableDate(date)].filter(Boolean).join(" · "),
      tocTitle: "Contents",
      // Missing/unreachable images shouldn't ever fail the whole build —
      // better to ship the EPUB without one photo than not ship it at all.
      ignoreFailedDownloads: true,
    },
    [
      {
        title,
        content: galleryHtml + bodyHtml,
      },
    ]
  );
  fs.writeFileSync(outputPath, buffer);
}

module.exports = async function generateReaderFiles(outputDir) {
  let count = 0;

  for (const section of SECTIONS) {
    const dirPath = path.resolve(section.dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith(".md"));

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dirPath, file), "utf8");
      const { data, content } = matter(raw);
      if (!data.title || !data.date) continue;

      const slug = path.basename(file, path.extname(file));
      const pageDir = path.join(outputDir, section.url, slug);
      if (!fs.existsSync(pageDir)) continue; // page wasn't built (e.g. draft), skip

      await generatePdf(path.join(pageDir, "story.pdf"), data, toPlainMarkdown(content));
      await generateEpub(path.join(pageDir, "story.epub"), data, content);
      count += 1;
    }
  }

  return count;
};
