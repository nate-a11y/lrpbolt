#!/bin/bash
set -euo pipefail

echo "=== Force Deploy Email Functions with Code Modification ==="
echo ""

PROJECT_ID="lrp---claim-portal"

# Navigate to functions directory
cd "$(dirname "$0")/functions"

# Make a real code change by adding a version comment
BUILD_ID="$(date +%Y%m%d%H%M%S)"
echo "Adding build ID: $BUILD_ID"

# Add version info to gmailHelper.js
if ! grep -q "BUILD_VERSION" gmailHelper.js; then
  # Add after the first line
  sed -i '1a // BUILD_VERSION: '"$BUILD_ID" gmailHelper.js
else
  # Update existing build version
  sed -i 's/\/\/ BUILD_VERSION: .*/\/\/ BUILD_VERSION: '"$BUILD_ID"'/' gmailHelper.js
fi

echo "Modified gmailHelper.js with build version"
cd ..

# Deploy
echo ""
echo "Deploying functions..."
firebase deploy --only functions:sendBulkTicketsEmail --project "$PROJECT_ID" --force

echo ""
echo "Checking deployed image version..."
gcloud run services describe sendbulkticketsemail \
  --region=us-central1 \
  --format=yaml | grep "image:"

echo ""
echo "✅ If you see a version number other than version_1, the new code is deployed!"
echo ""
echo "Reverting local changes..."
git checkout functions/gmailHelper.js

echo ""
echo "Done! Test email sending now."
