#!/usr/bin/env node
/**
 * ensure-lock-sync.mjs
 *
 * Exits with code 0 if package-lock.json satisfies package.json dependency ranges,
 * else prints a concise diff and exits 1.
 * Works with npm lockfile v2/v3 (npm 7-10).
 */

import fs from 'node:fs';
import path from 'node:path';

let semver;
try {
  ({ default: semver } = await import('semver'));
} catch {
  console.warn('⚠️  semver not found; using basic range checks');
  semver = {
    valid: (v) => /^\d+\.\d+\.\d+(?:-.+)?$/.test(v),
    satisfies: (v, range) => {
      if (range.startsWith('^')) {
        const [maj, min = 0, pat = 0] = range.slice(1).split('.').map(Number);
        const [vMaj, vMin = 0, vPat = 0] = v.split('.').map(Number);
        if (Number.isNaN(maj) || Number.isNaN(vMaj)) return false;
        if (vMaj !== maj) return false;
        if (vMin > min) return true;
        if (vMin === min) return vPat >= pat;
        return false;
      }
      if (range.startsWith('~')) {
        const [maj, min = 0, pat = 0] = range.slice(1).split('.').map(Number);
        const [vMaj, vMin = 0, vPat = 0] = v.split('.').map(Number);
        if (Number.isNaN(maj) || Number.isNaN(vMaj)) return false;
        if (vMaj !== maj || vMin !== min) return false;
        return vPat >= pat;
      }
      return v === range;
    }
  };
}

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

const pkg = readJson(pkgPath);
const lock = readJson(lockPath);

if (!pkg) {
  console.error('❌ package.json not found or unreadable.');
  process.exit(1);
}

if (!lock) {
  console.error('❌ package-lock.json not found. Run: npm run lock:rebuild');
  process.exit(1);
}

// Helpers for lockfile v2/v3
const hasTopDeps = lock && typeof lock.dependencies === 'object';
const packages = lock && lock.packages && typeof lock.packages === 'object' ? lock.packages : null;

function getLockedVersion(name) {
  // Lock v3 preferred
  if (packages) {
    const entry = packages[`node_modules/${name}`];
    if (entry && entry.version) return entry.version;
  }
  // Fallback: lock.v2/compat section
  if (hasTopDeps && lock.dependencies[name] && lock.dependencies[name].version) {
    return lock.dependencies[name].version;
  }
  return null;
}

function collect(section) {
  const obj = pkg[section] || {};
  return Object.keys(obj).map((name) => ({
    name,
    range: String(obj[name]).trim()
  }));
}

const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const problems = [];

for (const sec of sections) {
  for (const { name, range } of collect(sec)) {
    // ignore file:, link:, git refs etc. Let npm compute those.
    if (/^(file:|link:|git\+|https?:\/\/)/i.test(range)) continue;
    const locked = getLockedVersion(name);
    if (!locked) {
      problems.push({ name, range, locked: '(missing)', reason: 'missing' });
      continue;
    }
    // If range is "workspace:*" or similar, skip strict check
    if (/^workspace:/.test(range)) continue;

    // Allow prerelease sats if explicitly ranged
    const ok = semver.valid(locked) && semver.satisfies(locked, range, { includePrerelease: true });
    if (!ok) {
      problems.push({ name, range, locked });
    }
  }
}

if (problems.length) {
  console.error('❌ package-lock.json is out of sync with package.json:\n');
  for (const p of problems) {
    console.error(`- ${p.name}: wanted ${p.range}, locked ${p.locked}`);
  }
  console.error('\n➡ Run: npm run lock:rebuild\n');
  process.exit(1);
}

console.log('✅ package-lock.json is in sync with package.json.');
process.exit(0);
