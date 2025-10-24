#!/bin/bash
# Fix shuttle ticket email by configuring the Cloud Run service
# This script sets the required environment variables for the sendShuttleTicketEmail function

set -euo pipefail

echo "============================================"
echo "Shuttle Ticket Email Fix Script"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required environment variables are set
echo "Checking required environment variables..."

if [ -z "${GCAL_SA_EMAIL:-}" ]; then
  echo -e "${RED}✗ GCAL_SA_EMAIL not set${NC}"
  echo "  This should be your service account email"
  echo "  Example: your-sa@your-project.iam.gserviceaccount.com"
  exit 1
fi

if [ -z "${GCAL_SA_PRIVATE_KEY:-}" ]; then
  echo -e "${RED}✗ GCAL_SA_PRIVATE_KEY not set${NC}"
  echo "  This should be your service account private key"
  exit 1
fi

if [ -z "${GMAIL_SENDER:-}" ]; then
  echo -e "${RED}✗ GMAIL_SENDER not set${NC}"
  echo "  This should be the email address to send from"
  echo "  Example: contactus@lakeridepros.com"
  exit 1
fi

echo -e "${GREEN}✓ All required environment variables are set${NC}"
echo ""

# Get the project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}✗ No active gcloud project${NC}"
  echo "  Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Project: $PROJECT_ID"
echo "Service Account: $GCAL_SA_EMAIL"
echo "Gmail Sender: $GMAIL_SENDER"
echo ""

# Check if service exists
echo "Checking if sendshuttleticketemail service exists..."
if gcloud run services describe sendshuttleticketemail \
  --region=us-central1 \
  --platform=managed \
  --format="value(metadata.name)" 2>/dev/null; then
  echo -e "${GREEN}✓ Service exists${NC}"
else
  echo -e "${YELLOW}⚠ Service does not exist${NC}"
  echo "  The function needs to be deployed first"
  echo "  Run: firebase deploy --only functions:sendShuttleTicketEmail"
  echo ""
  echo "  Or push changes to trigger CI/CD which will deploy it"
  exit 1
fi

echo ""
echo "Updating sendshuttleticketemail with environment variables..."

gcloud run services update sendshuttleticketemail \
  --region=us-central1 \
  --platform=managed \
  --set-env-vars="^@@^GCAL_SA_EMAIL=${GCAL_SA_EMAIL}@@GCAL_SA_PRIVATE_KEY=${GCAL_SA_PRIVATE_KEY}@@GMAIL_SENDER=${GMAIL_SENDER}" \
  --quiet

echo -e "${GREEN}✓ Configuration complete!${NC}"
echo ""
echo "The sendShuttleTicketEmail function is now configured with:"
echo "  ✓ GCAL_SA_EMAIL"
echo "  ✓ GCAL_SA_PRIVATE_KEY"
echo "  ✓ GMAIL_SENDER"
echo ""
echo "You can now test the email functionality from your application."
echo ""
echo "To verify the configuration:"
echo "  gcloud run services describe sendshuttleticketemail --region=us-central1 --format=yaml | grep -A 10 'env:'"
echo ""
