# Email Tickets Configuration

## Issue
The `sendBulkTicketsEmail` Cloud Function is returning 500 errors because Gmail API authentication is failing.

## Root Cause
The function requires Gmail API service account credentials to be configured as environment variables in Cloud Functions v2. These must be set using `gcloud` CLI, not through the Firebase console.

## Required Environment Variables

The following environment variables must be set on the Cloud Function:

1. **GCAL_SA_EMAIL** - Service account email (e.g., `service-account@project.iam.gserviceaccount.com`)
2. **GCAL_SA_PRIVATE_KEY** - Service account private key (JSON format, with `\n` for newlines)
3. **GMAIL_SENDER** - Email address to send from (e.g., `contactus@lakeridepros.com`)

## How to Fix

### Step 1: Get Service Account Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **IAM & Admin** → **Service Accounts**
3. Find or create a service account with Gmail API permissions
4. Download the JSON key file

### Step 2: Set Environment Variables
Use the `gcloud` CLI to set environment variables on the deployed function:

```bash
# Set service account email
gcloud run services update sendBulkTicketsEmail \
  --region=us-central1 \
  --set-env-vars="GCAL_SA_EMAIL=your-service-account@project.iam.gserviceaccount.com"

# Set private key (note: replace \n with \\n in the key)
gcloud run services update sendBulkTicketsEmail \
  --region=us-central1 \
  --set-env-vars="GCAL_SA_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----"

# Set sender email
gcloud run services update sendBulkTicketsEmail \
  --region=us-central1 \
  --set-env-vars="GMAIL_SENDER=contactus@lakeridepros.com"
```

### Step 3: Enable Gmail API
1. Go to [Google Cloud Console API Library](https://console.cloud.google.com/apis/library)
2. Search for "Gmail API"
3. Click **Enable**

### Step 4: Domain-Wide Delegation (if needed)
If using domain-wide delegation to send emails on behalf of users:

1. Go to [Google Workspace Admin Console](https://admin.google.com)
2. Navigate to **Security** → **API Controls** → **Domain-wide Delegation**
3. Add the service account client ID with scope: `https://www.googleapis.com/auth/gmail.send`

## Testing
After configuration, test the function:

```javascript
// In Firebase Console → Functions → sendBulkTicketsEmail → Testing tab
{
  "to": "test@example.com",
  "subject": "Test Shuttle Ticket",
  "message": "This is a test email",
  "attachments": [{
    "filename": "test-ticket.png",
    "dataUrl": "data:image/png;base64,iVBORw0KG..."
  }]
}
```

## Fallback Behavior
If email sending fails, the frontend automatically:
1. Downloads tickets as a ZIP file instead
2. Shows a warning message to the user
3. Logs the error for debugging

This ensures users can still get their tickets even when the email service is unavailable.

## Logs
Check Cloud Functions logs for detailed error information:
```bash
gcloud functions logs read sendBulkTicketsEmail --region=us-central1 --limit=50
```

Look for entries with:
- "All email sends failed" - indicates all attempts failed
- "Missing GCAL_SA_EMAIL / GCAL_SA_PRIVATE_KEY" - environment variables not set
- Gmail API errors - check API quotas and permissions
