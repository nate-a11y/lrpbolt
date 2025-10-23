#!/bin/bash
# Setup script for configuring the bulk tickets email endpoint
# Run this on your local machine where Firebase CLI is installed

set -e

echo "============================================"
echo "Email Endpoint Setup Script"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Error: Firebase CLI not found${NC}"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

echo -e "${GREEN}✓${NC} Firebase CLI found"

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}Error: Not logged into Firebase${NC}"
    echo "Run: firebase login"
    exit 1
fi

echo -e "${GREEN}✓${NC} Logged into Firebase"

# Confirm project
echo ""
echo "Current Firebase project:"
firebase use

echo ""
read -p "Is this the correct project (lrp---claim-portal)? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Run: firebase use lrp---claim-portal"
    exit 1
fi

echo ""
echo "============================================"
echo "Step 1: Check Current Configuration"
echo "============================================"
echo ""

echo "Current Firebase Functions config:"
firebase functions:config:get

echo ""
echo "============================================"
echo "Step 2: Set Environment Variables"
echo "============================================"
echo ""

echo -e "${YELLOW}Note:${NC} You should have these values from your GitHub secrets:"
echo "  - GCAL_SA_EMAIL"
echo "  - GCAL_SA_PRIVATE_KEY"
echo "  - GMAIL_SENDER"
echo ""

read -p "Do you want to set Firebase Functions environment variables now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Enter the service account email (GCAL_SA_EMAIL):"
    read -r sa_email

    echo "Enter the sender email (GMAIL_SENDER, e.g., contactus@lakeridepros.com):"
    read -r sender_email

    echo ""
    echo "Enter the private key. Paste the ENTIRE private key including:"
    echo "-----BEGIN PRIVATE KEY-----"
    echo "and"
    echo "-----END PRIVATE KEY-----"
    echo ""
    echo "Then press Ctrl+D when done:"
    private_key=$(cat)

    echo ""
    echo "Setting Firebase Functions config..."

    firebase functions:config:set \
        gcal.sa_email="$sa_email" \
        gcal.sa_private_key="$private_key" \
        gmail.sender="$sender_email"

    echo -e "${GREEN}✓${NC} Environment variables set"
else
    echo -e "${YELLOW}Skipping environment variable setup${NC}"
fi

echo ""
echo "============================================"
echo "Step 3: Deploy Cloud Function"
echo "============================================"
echo ""

read -p "Deploy sendBulkTicketsEmail function now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Deploying function..."
    firebase deploy --only functions:sendBulkTicketsEmail
    echo ""
    echo -e "${GREEN}✓${NC} Function deployed successfully"
    echo ""
    echo "Function URL:"
    echo "https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail"
else
    echo -e "${YELLOW}Skipping deployment${NC}"
fi

echo ""
echo "============================================"
echo "Step 4: GitHub Secret"
echo "============================================"
echo ""

echo "Add this GitHub repository secret:"
echo ""
echo -e "${GREEN}Name:${NC} VITE_TICKETS_EMAIL_ENDPOINT"
echo -e "${GREEN}Value:${NC} https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail"
echo ""
echo "Go to: https://github.com/nate-a11y/lrpbolt/settings/secrets/actions"
echo ""

read -p "Press Enter when you've added the GitHub secret..."

echo ""
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Rebuild your application (push to main or trigger CI/CD)"
echo "2. Test the email feature from the Tickets page"
echo ""
echo "To test the function directly:"
echo "  firebase functions:shell"
echo ""
echo "To view logs:"
echo "  firebase functions:log --only sendBulkTicketsEmail"
echo ""
echo "For troubleshooting, see: SETUP-EMAIL-ENDPOINT.md"
echo ""
