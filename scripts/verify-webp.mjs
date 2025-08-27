import fs from 'fs';

import { globby } from 'globby';

import { outPathFor } from './shared-image-paths.mjs';

const SRC_DIRS = ['public/DropOffPics', 'public/images', 'src/assets'];

const patterns = SRC_DIRS.flatMap(d => [`${d}/**/*.{png,jpg,jpeg}`]);
const files = await globby(patterns, { caseSensitiveMatch: false });

const missing = [];
for (const src of files) {
  const out = outPathFor(src);
  if (!fs.existsSync(out)) missing.push(`${src} -> ${out}`);
}

if (missing.length) {
  console.error('❌ Missing WebP for:');
  missing.forEach(m => console.error('  ' + m));
  process.exit(1);
} else {
  console.log('✅ All WebP assets present');
}
