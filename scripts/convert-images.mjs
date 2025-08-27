// Converts JPG/PNG to WebP only if needed, and commits results-friendly paths.
// Run: npm run images:build
import fs from 'fs';
import path from 'path';
import { globby } from 'globby';
import sharp from 'sharp';

// Directories containing source images
const SRC_DIRS = ['public/DropOffPics'];
// Root directory for generated WebP files (committed)
const OUT_ROOT = 'public/webp';
const QUALITY = 82; // tweak as needed

function outPathFor(src) {
  const abs = path.resolve(src);
  const rel = path.relative(process.cwd(), abs);
  const withoutPublic = rel.replace(/^public[\\/]/, '');
  const outRel = withoutPublic.replace(/\.(png|jpe?g)$/i, '.webp');
  return path.join(OUT_ROOT, outRel);
}

async function ensureDir(p) {
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
}

async function shouldBuild(src, out) {
  try {
    const [s, o] = await Promise.all([
      fs.promises.stat(src),
      fs.promises.stat(out),
    ]);
    return s.mtimeMs > o.mtimeMs;
  } catch (err) {
    if (err && err.code === 'ENOENT') return true;
    throw err;
  }
}

async function toWebp(src, out) {
  await ensureDir(out);
  try {
    await sharp(src).webp({ quality: QUALITY }).toFile(out);
  } catch (err) {
    await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .webp({ quality: QUALITY })
      .toFile(out);
    console.warn(`placeholder for ${src}: ${err.message}`);
  }
  return out;
}

async function run() {
  const patterns = SRC_DIRS.map((d) => `${d}/**/*.{png,jpg,jpeg}`);
  const files = await globby(patterns, { caseSensitiveMatch: false });
  let converted = 0;
  for (const src of files) {
    const out = outPathFor(src);
    if (await shouldBuild(src, out)) {
      await toWebp(src, out);
      converted++;
      console.log(`✔︎ ${src} -> ${out}`);
    } else {
      console.log(`skip ${src}`);
    }
  }
  console.log(`\nDone. Converted ${converted} file(s).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
