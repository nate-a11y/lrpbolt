#!/bin/bash
set -euo pipefail

echo "=== Force Deploy with Real Code Change ==="
echo ""

cd /home/user/lrpbolt
git checkout main
git pull origin main

echo "Adding a runtime log statement to force rebuild..."

# Add a real log line that changes runtime behavior
BUILD_ID=$(date +%Y%m%d%H%M%S)

cd functions

# Add a log statement after the first function definition
# This is a REAL code change, not just a comment
cat > /tmp/patch.txt << 'EOF'
function getGmailJwt(impersonateEmail = null) {
  logger.info("Gmail JWT initialization", { timestamp: Date.now() });
  const email = process.env.GCAL_SA_EMAIL;
EOF

# Insert the log line after "function getGmailJwt"
sed -i '/^function getGmailJwt(impersonateEmail = null) {$/a\  logger.info("Gmail JWT initialization", { timestamp: Date.now() });' gmailHelper.js

echo "Modified gmailHelper.js - added runtime log statement"
echo ""
echo "Showing the modification:"
grep -A 2 "function getGmailJwt" gmailHelper.js | head -5

cd ..

echo ""
echo "Deploying with REAL code change..."
firebase deploy --only functions:sendBulkTicketsEmail --project lrp---claim-portal --force

echo ""
echo "Waiting for deployment to complete..."
sleep 15

echo ""
echo "Checking image version:"
gcloud run services describe sendbulkticketsemail \
  --region=us-central1 \
  --format=yaml | grep -E "(image:|revisionName:)"

echo ""
echo "If you see version_2 or higher, SUCCESS!"
echo "If still version_1, we need to try a different approach."
