#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
FUNCTIONS_DIR="${ROOT_DIR}/functions"

echo "🔎 Scanning for v1 API usage in functions/…"
if [[ ! -d "${FUNCTIONS_DIR}" ]]; then
  echo "⚠️ functions directory not found at ${FUNCTIONS_DIR}" >&2
  exit 1
fi
bad=$(grep -RInE "functions\\.firestore|functions\\.https|functions\\.config\(\)" "${FUNCTIONS_DIR}" \
  --exclude-dir=node_modules --exclude-dir=.git || true)
if [[ -n "$bad" ]]; then
  echo "❌ Found legacy v1 usage:"
  echo "$bad"
  exit 1
fi
echo "✅ No legacy v1 API usage detected."
