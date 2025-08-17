#!/usr/bin/env bash
set -euo pipefail
DIST=dist
BUCKET="s3://<your-bucket>"
DISTRIBUTION_ID="<your-cf-id>"

npm run build

# Long-lived immutable for hashed assets
aws s3 sync "$DIST/assets" "$BUCKET/assets" --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --content-type "application/javascript"

# Root files: no-cache
aws s3 cp "$DIST/index.html" "$BUCKET/index.html" --cache-control "no-cache" --content-type "text/html"
aws s3 cp "$DIST/manifest.webmanifest" "$BUCKET/manifest.webmanifest" --cache-control "no-cache" --content-type "application/manifest+json" || true
aws s3 cp "$DIST/sw.js" "$BUCKET/sw.js" --cache-control "no-cache" --content-type "application/javascript"
# Workbox helper chunks
aws s3 cp "$DIST" "$BUCKET" --recursive --exclude "*" --include "workbox-*.js" \
  --cache-control "no-cache" --content-type "application/javascript"

# Any other root assets
aws s3 sync "$DIST" "$BUCKET" --exclude "assets/*" --exclude "index.html" --exclude "sw.js" --exclude "workbox-*.js" \
  --cache-control "no-cache"

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
echo "Deployed to $BUCKET and invalidated CloudFront."
