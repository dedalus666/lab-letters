#!/usr/bin/env node
// Resize + compress photos before they go into src/images/. Caps the
// longest side at 1800px and re-saves at a web-friendly quality setting,
// so nothing goes into the archive at full camera resolution/size.
//
// Usage:
//   npm run resize-photos                     (defaults to src/images)
//   npm run resize-photos -- path/to/folder    (any other folder of photos)
//
// Safe to point at src/images itself and re-run any time — files that are
// already small enough are left alone instead of being re-compressed again.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MAX_DIMENSION = 1800; // longest side, in pixels
const JPEG_QUALITY = 78;
const PNG_QUALITY = 80;
const SKIP_UNDER_BYTES = 350 * 1024; // already small enough — don't touch it

const targetDir = path.resolve(process.argv[2] || "src/images");
const jpegExts = [".jpg", ".jpeg"];
const pngExts = [".png"];

async function processFile(file) {
  const filePath = path.join(targetDir, file);
  const ext = path.extname(file).toLowerCase();
  const before = fs.statSync(filePath).size;

  if (before < SKIP_UNDER_BYTES) {
    console.log(`${file.padEnd(28)} already small (${(before / 1024).toFixed(0)}KB) — skipped`);
    return { before, after: before };
  }

  const buffer = fs.readFileSync(filePath);
  let pipeline = sharp(buffer).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  pipeline = jpegExts.includes(ext)
    ? pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    : pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 });

  const output = await pipeline.toBuffer();
  fs.writeFileSync(filePath, output);

  console.log(
    `${file.padEnd(28)} ${(before / 1024).toFixed(0).padStart(6)}KB -> ${(output.length / 1024).toFixed(0).padStart(6)}KB`
  );
  return { before, after: output.length };
}

async function run() {
  if (!fs.existsSync(targetDir)) {
    console.error(`Folder not found: ${targetDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(targetDir)
    .filter((f) => [...jpegExts, ...pngExts].includes(path.extname(f).toLowerCase()));

  if (!files.length) {
    console.log(`No jpg/jpeg/png images found in ${targetDir}`);
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;
  const failures = [];

  for (const file of files) {
    try {
      const { before, after } = await processFile(file);
      totalBefore += before;
      totalAfter += after;
    } catch (err) {
      console.error(`${file.padEnd(28)} FAILED — ${err.code || err.message}`);
      failures.push(file);
    }
  }

  const pct = totalBefore ? 100 * (1 - totalAfter / totalBefore) : 0;
  console.log(
    `\nTOTAL: ${(totalBefore / 1024).toFixed(0)}KB -> ${(totalAfter / 1024).toFixed(0)}KB (${pct.toFixed(0)}% smaller)`
  );

  if (failures.length) {
    console.log(`\n${failures.length} file(s) skipped due to errors — nothing else was affected:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
