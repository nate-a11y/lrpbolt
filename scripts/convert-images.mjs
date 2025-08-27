import fs from 'fs';
import path from 'path';
import { globby } from 'globby';
import sharp from 'sharp';
import { OUT_ROOT, outPathFor } from './shared-image-paths.mjs';

const SRC_DIRS = ['public/DropOffPics', 'public/images', 'src/assets']; // adjust as needed
const QUALITY = 82;

async function ensureDir(p) { await fs.promises.mkdir(path.dirname(p), { recursive: true }); }

async function shouldBuild(src, out) {
  try {
    const [s, o] = await Promise.all([fs.promises.stat(src), fs.promises.stat(out)]);
    return s.mtimeMs > o.mtimeMs;
  } catch (e) {
    if (e?.code === 'ENOENT') return true;
    throw e;
  }
}

async function toWebp(src, out) {
  await ensureDir(out);
  await sharp(src).webp({ quality: QUALITY }).toFile(out);
  console.log(`✔︎ ${src} -> ${out}`);
}

(async () => {
  const patterns = SRC_DIRS.flatMap(d => [`${d}/**/*.{png,jpg,jpeg}`]);
  const files = await globby(patterns, { caseSensitiveMatch: false });
  let converted = 0;
  for (const src of files) {
    const out = outPathFor(src);
    if (await shouldBuild(src, out)) {
      await toWebp(src, out);
      converted++;
    } else {
      console.log(`skip ${src}`);
    }
  }
  console.log(`Done. Converted ${converted} file(s). Output root: ${OUT_ROOT}`);
})().catch(err => { console.error(err); process.exit(1); });
