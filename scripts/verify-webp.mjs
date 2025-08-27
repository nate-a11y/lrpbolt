import { globby } from 'globby';
import fs from 'fs';
import path from 'path';

const SRC_DIRS = ['public/DropOffPics'];
const OUT_ROOT = 'public/webp';
const missing = [];

function outPathFor(src) {
  const rel = path.relative(process.cwd(), path.resolve(src));
  const withoutPublic = rel.replace(/^public[\\/]/, '');
  return path.join(OUT_ROOT, withoutPublic.replace(/\.(png|jpe?g)$/i, '.webp'));
}

const patterns = SRC_DIRS.map((d) => `${d}/**/*.{png,jpg,jpeg}`);
const files = await globby(patterns, { caseSensitiveMatch: false });

for (const f of files) {
  const out = outPathFor(f);
  if (!fs.existsSync(out)) missing.push(`${f} -> ${out}`);
}

if (missing.length) {
  console.error('❌ Missing WebP for:');
  for (const m of missing) console.error('  ', m);
  process.exit(1);
} else {
  console.log('✅ All WebP assets present');
}
