/* Proprietary and confidential. See LICENSE. */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "public", "DropOffPics");
if (!fs.existsSync(SRC_DIR)) {
  console.log("No DropOffPics directory, skipping.");
  process.exit(0);
}

const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

if (files.length === 0) {
  console.log("No PNG/JPG files found, skipping.");
  process.exit(0);
}

await Promise.all(
  files.map(async (file) => {
    const inPath = path.join(SRC_DIR, file);
    const base = file.replace(/\.(png|jpg|jpeg)$/i, "");
    const outPath = path.join(SRC_DIR, `${base}.webp`);

    // Skip if a newer webp already exists
    if (fs.existsSync(outPath)) {
      const inStat = fs.statSync(inPath);
      const outStat = fs.statSync(outPath);
      if (outStat.mtimeMs >= inStat.mtimeMs) return;
    }

    try {
      await sharp(inPath)
        .webp({ quality: 82 }) // balance size/quality
        .toFile(outPath);
      console.log(`→ ${path.basename(outPath)}`);
    } catch (e) {
      console.error(`Failed: ${file}`, e.message);
    }
  })
);

console.log("Image optimization complete.");
