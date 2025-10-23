#!/bin/bash
# Configure sendShuttleTicketEmail Cloud Function with required environment variables

set -euo pipefail

echo "🔧 Configuring sendShuttleTicketEmail Cloud Function..."

# Check if required environment variables are set
if [ -z "${GCAL_SA_EMAIL:-}" ] || [ -z "${GCAL_SA_PRIVATE_KEY:-}" ] || [ -z "${GMAIL_SENDER:-}" ]; then
  echo "❌ Error: Required environment variables not set"
  echo "Please set: GCAL_SA_EMAIL, GCAL_SA_PRIVATE_KEY, GMAIL_SENDER"
  exit 1
fi

# Get the project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No active gcloud project. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "📋 Project: $PROJECT_ID"
echo "📧 Gmail Sender: $GMAIL_SENDER"

# Update the Cloud Run service with environment variables
echo "🚀 Updating sendshuttleticketemail service..."
gcloud run services update sendshuttleticketemail \
  --region=us-central1 \
  --platform=managed \
  --set-env-vars="^@@^GCAL_SA_EMAIL=${GCAL_SA_EMAIL}@@GCAL_SA_PRIVATE_KEY=${GCAL_SA_PRIVATE_KEY}@@GMAIL_SENDER=${GMAIL_SENDER}" \
  --quiet

echo "✅ Configuration complete!"
echo ""
echo "The sendShuttleTicketEmail function is now configured with:"
echo "  - GCAL_SA_EMAIL"
echo "  - GCAL_SA_PRIVATE_KEY"
echo "  - GMAIL_SENDER"
