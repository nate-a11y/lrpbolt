#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function fail(message) {
  console.error(message);
  process.exit(1);
}

let packageJson;
let resolvedPath;
try {
  resolvedPath = require.resolve('happy-dom/package.json', { paths: [process.cwd()] });
  // eslint-disable-next-line import/no-dynamic-require, global-require
  packageJson = require(resolvedPath);
} catch (error) {
  if (error && (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')) {
    fail('happy-dom not installed. Ensure overrides/resolutions enforce happy-dom@20.');
  }

  console.error('Unexpected error while resolving happy-dom package.json.');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}

const version = packageJson && packageJson.version;
if (typeof version !== 'string') {
  fail(`Unable to determine happy-dom version from ${resolvedPath}.`);
}

const major = Number.parseInt(version.split('.')[0], 10);
if (!Number.isFinite(major)) {
  fail(`happy-dom version "${version}" is not a valid semver string.`);
}

if (major < 20) {
  fail(`happy-dom ${version} detected. Version 20 or newer is required.`);
}

console.log(`happy-dom ${version} verified (>=20).`);

