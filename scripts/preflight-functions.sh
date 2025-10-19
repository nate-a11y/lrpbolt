#!/usr/bin/env bash
set -euo pipefail
BASE_REF="${1:-origin/main}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

extract_exports() {
  awk 'match($0,/exports\.([A-Za-z0-9_]+)[[:space:]]*=\s*/,m){print m[1]}' | sort -u
}

mkdir -p .tmp

if [ -f functions/index.js ]; then
  grep -E 'exports\.[A-Za-z0-9_]+' functions/index.js | extract_exports > .tmp/exports.curr || true
else
  : > .tmp/exports.curr
fi

if git cat-file -e "${BASE_REF}:functions/index.js" 2>/dev/null; then
  git show "${BASE_REF}:functions/index.js" | grep -E 'exports\.[A-Za-z0-9_]+' | extract_exports > .tmp/exports.base || true
else
  : > .tmp/exports.base
fi

echo "Current exports:"
sed 's/^/  • /' .tmp/exports.curr || true
echo

echo "Base exports (${BASE_REF}):"
sed 's/^/  • /' .tmp/exports.base || true
echo

echo "Diff vs ${BASE_REF}:"
comm -13 .tmp/exports.base .tmp/exports.curr | sed 's/^/  + /' || true
comm -23 .tmp/exports.base .tmp/exports.curr | sed 's/^/  - /' || true

node -e 'require("./functions/index.js"); console.log("require OK")'

npx --yes firebase-tools@latest emulators:exec --only functions "node -e \"console.log('functions analyzer OK')\""

echo "✔ preflight complete"
