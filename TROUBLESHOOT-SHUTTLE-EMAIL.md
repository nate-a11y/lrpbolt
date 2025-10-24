# Troubleshooting Shuttle Ticket Email

This guide helps you fix issues with the shuttle ticket email functionality.

## Quick Fix

If shuttle ticket emails are not sending, the most common issue is that the Cloud Run service doesn't have the required environment variables configured.

### Prerequisites

You need these GitHub secrets (ask admin if you don't have them):
- `GCAL_SA_EMAIL` - Service account email
- `GCAL_SA_PRIVATE_KEY` - Service account private key
- `GMAIL_SENDER` - Email address to send from (e.g., contactus@lakeridepros.com)

### Option 1: Trigger CI/CD (Recommended)

The easiest fix is to trigger the CI/CD workflow, which will automatically configure everything:

```bash
# Make a small change to any function file to trigger deployment
cd functions
git commit --allow-empty -m "Trigger function deployment to fix email config"
git push
```

The CI/CD workflow will:
1. Deploy the `sendShuttleTicketEmail` function
2. Automatically configure the Cloud Run service with environment variables
3. Deploy the `sendBulkTicketsEmail` function and configure it too

### Option 2: Manual Fix (If you have gcloud access)

If you have gcloud CLI and the secrets available as environment variables:

```bash
# Set environment variables (get values from GitHub secrets)
export GCAL_SA_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
export GCAL_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
export GMAIL_SENDER="contactus@lakeridepros.com"

# Run the fix script
./scripts/fix-shuttle-email.sh
```

## Understanding the Issue

### Background

The shuttle ticket email feature uses:
1. **Frontend** (`TicketGenerator.jsx`) → Calls `emailTicket` function
2. **API Hook** (`src/hooks/api.js`) → Calls Firebase callable function
3. **Cloud Function** (`sendShuttleTicketEmail`) → Uses Gmail API
4. **Gmail Helper** (`gmailHelper.js`) → Sends email via service account

### Why Environment Variables Are Required

Cloud Functions v2 (Gen 2) use Cloud Run under the hood. Environment variables must be set using:
- `gcloud run services update` ✅ Correct
- NOT `firebase functions:config:set` ❌ Won't work for v2

### What Can Go Wrong

1. **Function not deployed**
   - Solution: Deploy with `firebase deploy --only functions:sendShuttleTicketEmail`
   - Or trigger CI/CD by pushing to main

2. **Environment variables not set**
   - Solution: Run the fix script or trigger CI/CD
   - Verify with: `gcloud run services describe sendshuttleticketemail --region=us-central1`

3. **Gmail API not enabled**
   - Go to Google Cloud Console
   - Enable Gmail API for your project
   - Required scope: `https://www.googleapis.com/auth/gmail.send`

4. **Domain-wide delegation not configured**
   - This is required to send emails from a specific email address (e.g., contactus@lakeridepros.com)
   - Go to Google Workspace Admin Console
   - Security → API Controls → Domain-wide Delegation
   - Add service account with scope: `https://www.googleapis.com/auth/gmail.send`

5. **Service account doesn't have Gmail access**
   - The service account needs to be authorized to send emails on behalf of the sender
   - Check Google Workspace Admin Console settings

## Verifying the Fix

### 1. Check if function is deployed

```bash
firebase functions:list | grep sendShuttleTicketEmail
```

Expected output:
```
sendShuttleTicketEmail(us-central1)
```

### 2. Check environment variables

```bash
gcloud run services describe sendshuttleticketemail \
  --region=us-central1 \
  --format=yaml | grep -A 10 "env:"
```

Expected output should show:
```yaml
env:
- name: GCAL_SA_EMAIL
  value: your-sa@your-project.iam.gserviceaccount.com
- name: GCAL_SA_PRIVATE_KEY
  value: "-----BEGIN PRIVATE KEY-----\n..."
- name: GMAIL_SENDER
  value: contactus@lakeridepros.com
```

### 3. Test from application

1. Go to Tickets page
2. Generate a ticket
3. Click "Email Ticket"
4. Enter a valid email address
5. Click "Send"
6. Check for success message: "📧 Ticket emailed"

### 4. Check logs

If the test fails, check Cloud Function logs:

```bash
gcloud functions logs read sendshuttleticketemail \
  --region=us-central1 \
  --limit=50
```

Or in Firebase Console:
- Go to Functions section
- Click on `sendShuttleTicketEmail`
- View logs tab

## Common Error Messages

### "Missing GCAL_SA_EMAIL / GCAL_SA_PRIVATE_KEY"

**Cause:** Environment variables not set on Cloud Run service

**Solution:** Run fix script or trigger CI/CD

### "Failed to send email" or 403 Forbidden

**Cause:** Gmail API not properly configured or domain-wide delegation not set up

**Solution:**
1. Verify Gmail API is enabled in Google Cloud Console
2. Check domain-wide delegation in Google Workspace Admin Console
3. Verify service account has correct scopes

### "Ticket attachment missing"

**Cause:** Frontend issue generating ticket image

**Solution:** Check browser console for errors. The ticket image should be generated before calling email function.

### Function times out

**Cause:** Network issues or Gmail API taking too long

**Solution:**
1. Check Cloud Function timeout settings (should be at least 60s)
2. Check Gmail API status: https://status.cloud.google.com
3. Verify service account credentials are correct

## Architecture Overview

```
User clicks "Email Ticket"
  ↓
TicketGenerator.jsx generates PNG ticket
  ↓
Calls apiEmailTicket(ticketId, email, base64Image)
  ↓
src/hooks/api.js → Firebase callable function
  ↓
sendShuttleTicketEmail Cloud Function
  ↓
gmailHelper.js → Gmail API (via service account)
  ↓
Email sent via Gmail
```

## Getting Help

If you're still having issues:

1. **Check recent changes**
   ```bash
   git log --oneline --grep="email\|shuttle" -i --since="1 week ago"
   ```

2. **Review function code**
   - `functions/sendShuttleTicketEmail.js`
   - `functions/gmailHelper.js`

3. **Check GitHub secrets**
   - Go to: https://github.com/nate-a11y/lrpbolt/settings/secrets/actions
   - Verify: GCAL_SA_EMAIL, GCAL_SA_PRIVATE_KEY, GMAIL_SENDER

4. **Contact admin**
   - Provide error messages from logs
   - Share steps you've already tried

## Related Files

- `functions/sendShuttleTicketEmail.js` - Main Cloud Function
- `functions/gmailHelper.js` - Gmail API wrapper
- `src/hooks/api.js` - Frontend API (emailTicket function)
- `src/components/TicketGenerator.jsx` - UI component
- `.github/workflows/deploy.yml` - CI/CD configuration
- `scripts/fix-shuttle-email.sh` - Quick fix script
