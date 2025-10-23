# Bulk Tickets Email Cloud Function

## Overview

The `sendBulkTicketsEmail` Cloud Function sends multiple shuttle ticket images via email. This function is called by the Tickets page when users click the "Email" button to send selected tickets to customers.

## Setup

### 1. Server-Side Environment Variables

The function requires Gmail API credentials configured in the Cloud Functions environment:

```bash
# Set in Firebase Functions config or Cloud Functions environment
GCAL_SA_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
GCAL_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GMAIL_SENDER="contactus@lakeridepros.com"  # Email address to send from
```

These credentials are used by `gmailHelper.js` to send emails via the Gmail API.

#### Setting up Gmail API Service Account:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to "APIs & Services" > "Credentials"
4. Create a service account with Gmail API access
5. Enable domain-wide delegation if sending from a Google Workspace email
6. Grant the service account these scopes in Google Workspace Admin:
   - `https://www.googleapis.com/auth/gmail.send`

### 2. Client-Side Environment Variable

Add to your `.env` file:

```bash
# For your Firebase project: lrp---claim-portal
VITE_TICKETS_EMAIL_ENDPOINT=https://us-central1-lrp---claim-portal.cloudfunctions.net/sendBulkTicketsEmail
```

If this variable is not set, the Tickets page will automatically fall back to downloading tickets as a ZIP file instead of emailing them.

### 3. Deploy the Function

```bash
cd functions
firebase deploy --only functions:sendBulkTicketsEmail
```

## API

### Request Format

```javascript
{
  "to": "customer@example.com",
  "subject": "Your Tickets from Lake Ride Pros",
  "message": "Attached are your tickets...",
  "attachments": [
    {
      "filename": "TICKET-123.png",
      "dataUrl": "data:image/png;base64,iVBORw0KG..."
    },
    {
      "filename": "TICKET-456.png",
      "dataUrl": "data:image/png;base64,iVBORw0KG..."
    }
  ]
}
```

### Response Format

Success:
```javascript
{
  "success": true,
  "messageIds": ["msg_id_1", "msg_id_2"],
  "sent": 2,
  "total": 2
}
```

Error:
```javascript
{
  "error": {
    "code": "invalid-argument",
    "message": "Missing or invalid recipient email"
  }
}
```

## Implementation Notes

- Currently sends each ticket as a separate email (one attachment per email)
- The `gmailHelper.sendEmailWithAttachment()` function supports only single attachments
- Future enhancement: Update `gmailHelper` to support multiple attachments in one email
- Base64 data URLs are automatically parsed and cleaned before sending
- Invalid attachments are skipped with a warning logged

## Fallback Behavior

If the email endpoint is not configured or fails:
1. The client automatically falls back to ZIP download
2. No error is logged to prevent false alerts
3. User sees a notification: "Email not configured — ZIP downloaded"

## Testing

Test the function using Firebase CLI:

```bash
firebase functions:shell

# In the shell:
sendBulkTicketsEmail({
  data: {
    to: "test@example.com",
    subject: "Test Tickets",
    message: "Test message",
    attachments: [{
      filename: "test.png",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }]
  }
})
```

## Related Files

- `/src/services/emailTickets.js` - Client-side service that calls this function
- `/src/components/Tickets.jsx` - UI that uses the email feature (line 1172-1253)
- `/functions/gmailHelper.js` - Gmail API wrapper used by this function
- `/functions/sendShuttleTicketEmail.js` - Single-ticket email function (legacy)
