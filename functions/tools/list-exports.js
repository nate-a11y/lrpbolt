#!/usr/bin/env node
const path = require("path");

try {
  const functionsModulePath = path.join(__dirname, "..", "index.js");
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const exportsObj = require(functionsModulePath);
  const names = Object.keys(exportsObj || {}).sort();
  if (!names.length) {
    console.log("⚠️  No function exports detected.");
    process.exit(1);
  }
  console.log("📦 Functions exports (sorted):");
  names.forEach((name) => console.log(` - ${name}`));
} catch (error) {
  // eslint-disable-next-line no-console
  console.error("list-exports", error?.stack || error?.message || error);
  process.exit(1);
}
