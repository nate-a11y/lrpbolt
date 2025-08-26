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
# Any other root assets
aws s3 sync "$DIST" "$BUCKET" --exclude "assets/*" --exclude "index.html" \
  --cache-control "no-cache"

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
echo "Deployed to $BUCKET and invalidated CloudFront."
