#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '..', 'dist');
const sw = path.join(dist, 'sw.js');
const text = fs.readFileSync(sw, 'utf8');

const m = text.match(/self\.__WB_MANIFEST\s*=\s*(\[[\s\S]*?\]);?/);
if (!m) process.exit(0);

const manifest = eval(m[1]); // workbox injects an array of {url, revision}

let missing = [];
for (const e of manifest) {
  const p = path.join(dist, e.url.replace(/^\//, ''));
  if (!fs.existsSync(p)) missing.push(e.url);
}

if (missing.length) {
  console.error('Missing precache URLs:', missing);
  process.exit(1);
} else {
  console.log('Precache verification OK.');
}
