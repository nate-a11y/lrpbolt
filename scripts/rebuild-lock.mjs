#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();

const remove = (p) => {
  try {
    fs.rmSync(path.join(root, p), { recursive: true, force: true });
  } catch {}
};

remove('node_modules');
remove('package-lock.json');

try {
  execSync('npm install --package-lock-only --ignore-scripts', { stdio: 'inherit' });
  console.log('✅ lockfile rebuilt');
} catch (e) {
  console.error('❌ failed to rebuild lockfile');
  process.exit(e?.status || 1);
}
