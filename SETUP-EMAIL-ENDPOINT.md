# Email Endpoint Setup Guide

This guide will help you configure and deploy the email features for sending shuttle tickets.

## Email Functions

This project includes two email Cloud Functions:

1. **sendBulkTicketsEmail** - Sends multiple tickets to multiple recipients
2. **sendShuttleTicketEmail** - Sends a single ticket to one recipient

Both functions require the same environment variables and Gmail API configuration.

## Quick Start (Recommended)

**If you're using the automated CI/CD workflow** (which you likely are), you only need to:

1. Add GitHub secret: `VITE_TICKETS_EMAIL_ENDPOINT` = `https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail`
2. Push changes to main branch
3. The workflow will automatically deploy and configure **both** functions

The rest of this guide is for manual setup or troubleshooting.

## Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools` (only for manual deployment)
- Firebase project: `lrp---claim-portal`
- Google Service Account with Gmail API access (already configured in GitHub secrets)
- Domain-wide delegation configured (if sending from workspace email)

## Step 1: Verify Current Configuration

Run this command on your local machine to check the current Firebase Functions environment:

```bash
firebase functions:config:get
```

## Step 2: Set Firebase Functions Environment Variables

**⚠️ SKIP THIS STEP if using automated CI/CD deployment** - The workflow automatically configures these environment variables.

If deploying manually, the Cloud Functions need these environment variables to send emails via Gmail API:

```bash
firebase functions:config:set \
  gcal.sa_email="YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  gcal.sa_private_key="-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----" \
  gmail.sender="contactus@lakeridepros.com"
```

### Where to find these values:

1. **gcal.sa_email**: Found in your GitHub secrets as `GCAL_SA_EMAIL`
2. **gcal.sa_private_key**: Found in your GitHub secrets as `GCAL_SA_PRIVATE_KEY`
3. **gmail.sender**: Found in your GitHub secrets as `GMAIL_SENDER`

### Important Notes:

- The private key must include the `\n` characters for line breaks
- **Automated CI/CD**: The `.github/workflows/deploy.yml` workflow automatically sets these using `gcloud run services update` after deploying the function
- **Manual deployment**: Use `firebase functions:config:set` if not using the automated workflow

## Step 3: Deploy the Cloud Function

Deploy the new `sendBulkTicketsEmail` function:

```bash
# From the project root
firebase deploy --only functions:sendBulkTicketsEmail
```

This will deploy to: `https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail`

## Step 4: Add GitHub Secret

Add a new repository secret in GitHub:

**Name:** `VITE_TICKETS_EMAIL_ENDPOINT`
**Value:** `https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail`

This ensures your production builds include the endpoint URL.

**Note:** The CI/CD workflow (`.github/workflows/deploy.yml`) automatically configures **both** Cloud Run services (sendBulkTicketsEmail and sendShuttleTicketEmail) with the required environment variables (GCAL_SA_EMAIL, GCAL_SA_PRIVATE_KEY, GMAIL_SENDER) when deploying functions. You don't need to manually set these in Firebase Functions config if using the automated deployment.

### Manual Configuration (If Not Using CI/CD)

If you need to manually configure the sendShuttleTicketEmail function:

```bash
# Run from project root
./scripts/configure-shuttle-email.sh
```

Or use gcloud directly:

```bash
gcloud run services update sendshuttleticketemail \
  --region=us-central1 \
  --platform=managed \
  --set-env-vars="^@@^GCAL_SA_EMAIL=${GCAL_SA_EMAIL}@@GCAL_SA_PRIVATE_KEY=${GCAL_SA_PRIVATE_KEY}@@GMAIL_SENDER=${GMAIL_SENDER}" \
  --quiet
```

## Step 5: Verify the Setup

### Test the function directly:

```bash
firebase functions:shell
```

Then in the shell:

```javascript
sendBulkTicketsEmail({
  data: {
    to: "your-test-email@example.com",
    subject: "Test Shuttle Tickets",
    message: "Testing the bulk email function",
    attachments: [{
      filename: "test.png",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }]
  }
})
```

### Check logs:

```bash
firebase functions:log --only sendBulkTicketsEmail
```

## Step 6: Deploy Your Application

After the function is deployed and the GitHub secret is added:

1. Trigger a rebuild of your application (push to main or manually trigger CI/CD)
2. The new build will include the `VITE_TICKETS_EMAIL_ENDPOINT` variable
3. The email feature will be active in production

## Verification Checklist

- [ ] Firebase Functions environment variables are set
- [ ] Cloud Function `sendBulkTicketsEmail` is deployed
- [ ] GitHub secret `VITE_TICKETS_EMAIL_ENDPOINT` is added
- [ ] Application is rebuilt and deployed
- [ ] Test email sending from the Tickets page

## Troubleshooting

### Quick Fix: Email Not Working

If shuttle ticket emails are not sending, see the comprehensive troubleshooting guide:
**[TROUBLESHOOT-SHUTTLE-EMAIL.md](./TROUBLESHOOT-SHUTTLE-EMAIL.md)**

The quickest fix is usually to trigger CI/CD:
```bash
git commit --allow-empty -m "Trigger function deployment to fix email"
git push
```

### Error: "Missing GCAL_SA_EMAIL / GCAL_SA_PRIVATE_KEY"

**Solution:** The Cloud Run service environment variables are not set.

For Cloud Functions v2 (Gen 2), you MUST use `gcloud run services update`, not `firebase functions:config:set`.

Run the fix script:
```bash
./scripts/fix-shuttle-email.sh
```

Or trigger CI/CD which will automatically configure it.

### Error: "Failed to send email" or 403 errors

**Solution:** Check that:
1. Service account has Gmail API enabled
2. Domain-wide delegation is configured (if using workspace email)
3. Service account email is correct
4. Private key is properly formatted with `\n` characters

See [TROUBLESHOOT-SHUTTLE-EMAIL.md](./TROUBLESHOOT-SHUTTLE-EMAIL.md) for detailed steps.

### Email still downloads as ZIP

**Solution:** Check that:
1. `VITE_TICKETS_EMAIL_ENDPOINT` GitHub secret is set
2. Application has been rebuilt after adding the secret
3. Check browser console for the actual endpoint being called
4. Verify the endpoint URL is correct in your build

### Function times out or fails silently

**Solution:**
1. Check Cloud Function logs: `gcloud functions logs read sendshuttleticketemail --region=us-central1`
2. Ensure functions have sufficient memory and timeout (configured in firebase.json)
3. Test with a single small attachment first

### Environment variables not persisting after deployment

**Solution:** Cloud Functions v2 use Cloud Run. Environment variables must be set using `gcloud run services update`.

The CI/CD workflow handles this automatically. If you're deploying manually, use:
```bash
./scripts/fix-shuttle-email.sh
```

## Environment Variable Reference

### Firebase Functions (Server-side)
Set via `firebase functions:config:set`:
- `gcal.sa_email` - Service account email
- `gcal.sa_private_key` - Service account private key
- `gmail.sender` - Email address to send from

### GitHub Secrets (Build-time)
Set in GitHub repository settings:
- `VITE_TICKETS_EMAIL_ENDPOINT` - Cloud Function URL
- `GCAL_SA_EMAIL` - (For CI/CD builds)
- `GCAL_SA_PRIVATE_KEY` - (For CI/CD builds)
- `GMAIL_SENDER` - (For CI/CD builds)

### Local Development
Add to `.env.local`:
```bash
VITE_TICKETS_EMAIL_ENDPOINT=https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail
```

## Related Documentation

- See `functions/sendBulkTicketsEmail.README.md` for API details
- See `.env.example` for all environment variables
- See `src/services/emailTickets.js` for client-side implementation
