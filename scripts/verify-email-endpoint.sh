#!/bin/bash
# Verification script for email endpoint setup
# Run this to check if everything is configured correctly

set -e

echo "============================================"
echo "Email Endpoint Verification"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check Firebase CLI
echo -n "Checking Firebase CLI... "
if command -v firebase &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Install with: npm install -g firebase-tools"
    ERRORS=$((ERRORS+1))
fi

# Check if logged in
echo -n "Checking Firebase login... "
if firebase projects:list &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Run: firebase login"
    ERRORS=$((ERRORS+1))
fi

# Check project
echo -n "Checking Firebase project... "
PROJECT=$(firebase use 2>&1 | grep -o "lrp---claim-portal" || echo "")
if [ "$PROJECT" = "lrp---claim-portal" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Current project: $(firebase use 2>&1)"
    echo "  Run: firebase use lrp---claim-portal"
    ERRORS=$((ERRORS+1))
fi

# Check Functions config
echo ""
echo "Checking Firebase Functions config..."

CONFIG=$(firebase functions:config:get 2>&1)

echo -n "  gcal.sa_email... "
if echo "$CONFIG" | grep -q "sa_email"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS+1))
fi

echo -n "  gcal.sa_private_key... "
if echo "$CONFIG" | grep -q "sa_private_key"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS+1))
fi

echo -n "  gmail.sender... "
if echo "$CONFIG" | grep -q "sender"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS+1))
fi

# Check if function is deployed
echo ""
echo -n "Checking if sendBulkTicketsEmail is deployed... "

if firebase functions:list 2>&1 | grep -q "sendBulkTicketsEmail"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Run: firebase deploy --only functions:sendBulkTicketsEmail"
    ERRORS=$((ERRORS+1))
fi

# Check environment files
echo ""
echo "Checking local environment files..."

echo -n "  .env.example has VITE_TICKETS_EMAIL_ENDPOINT... "
if grep -q "VITE_TICKETS_EMAIL_ENDPOINT" .env.example 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS+1))
fi

# Summary
echo ""
echo "============================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    echo ""
    echo "Your email endpoint should be ready to use."
    echo ""
    echo "Function URL:"
    echo "https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail"
    echo ""
    echo "Don't forget to:"
    echo "1. Add VITE_TICKETS_EMAIL_ENDPOINT to GitHub secrets"
    echo "2. Rebuild and deploy your application"
else
    echo -e "${RED}Found $ERRORS issue(s)${NC}"
    echo ""
    echo "Please fix the issues above and run this script again."
    echo "For setup instructions, see: SETUP-EMAIL-ENDPOINT.md"
    exit 1
fi
