#!/bin/bash
set -euo pipefail

# Deploy email functions with domain-wide delegation fix
# This script deploys the updated gmailHelper.js that properly handles delegation

echo "=== Deploying Email Functions Fix ==="
echo ""

PROJECT_ID="lrp---claim-portal"
REGION="us-central1"

# Check if we have the required secrets
if [ -z "${GCAL_SA_EMAIL:-}" ] || [ -z "${GCAL_SA_PRIVATE_KEY:-}" ] || [ -z "${GMAIL_SENDER:-}" ]; then
    echo "❌ Error: Required environment variables not set"
    echo ""
    echo "Please set these environment variables first:"
    echo "  export GCAL_SA_EMAIL='calendar@lrp---claim-portal.iam.gserviceaccount.com'"
    echo "  export GCAL_SA_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----...'"
    echo "  export GMAIL_SENDER='contactus@lakeridepros.com'"
    echo ""
    echo "Or get them from GitHub secrets"
    exit 1
fi

echo "✅ Environment variables set"
echo ""

# Deploy the functions
echo "📦 Deploying sendBulkTicketsEmail function..."
firebase deploy --only functions:sendBulkTicketsEmail --project "$PROJECT_ID" --force

echo ""
echo "📦 Deploying sendShuttleTicketEmail function..."
firebase deploy --only functions:sendShuttleTicketEmail --project "$PROJECT_ID" --force

echo ""
echo "⚙️  Setting environment variables on Cloud Run..."

# Set environment variables on sendBulkTicketsEmail
gcloud run services update sendbulkticketsemail \
  --region="$REGION" \
  --platform=managed \
  --set-env-vars="^@@^GCAL_SA_EMAIL=${GCAL_SA_EMAIL}@@GCAL_SA_PRIVATE_KEY=${GCAL_SA_PRIVATE_KEY}@@GMAIL_SENDER=${GMAIL_SENDER}@@GMAIL_USE_DOMAIN_DELEGATION=true" \
  --project="$PROJECT_ID" \
  --quiet

echo "✅ sendBulkTicketsEmail configured"

# Set environment variables on sendShuttleTicketEmail
gcloud run services update sendshuttleticketemail \
  --region="$REGION" \
  --platform=managed \
  --set-env-vars="^@@^GCAL_SA_EMAIL=${GCAL_SA_EMAIL}@@GCAL_SA_PRIVATE_KEY=${GCAL_SA_PRIVATE_KEY}@@GMAIL_SENDER=${GMAIL_SENDER}@@GMAIL_USE_DOMAIN_DELEGATION=true" \
  --project="$PROJECT_ID" \
  --quiet

echo "✅ sendShuttleTicketEmail configured"

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Test email sending from your Tickets page."
echo ""
echo "To check logs:"
echo "  gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=sendbulkticketsemail' --limit=10 --format=json --project=$PROJECT_ID"
