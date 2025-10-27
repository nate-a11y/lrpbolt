/* Proprietary and confidential. See LICENSE. */
const { google } = require("googleapis");
const { logger } = require("firebase-functions/v2");

/**
 * Get JWT auth client using service account credentials
 * Supports optional impersonation for domain-wide delegation
 *
 * Environment variables are set via gcloud run services update (Cloud Functions v2)
 * NOT via firebase functions:config:set (that only works for v1)
 */
function getGmailJwt(impersonateEmail = null) {
  const email = process.env.GCAL_SA_EMAIL;
  const key = (process.env.GCAL_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) {
    logger.error("Gmail API configuration missing", {
      hasEmail: !!email,
      hasKey: !!key,
      note: "Environment variables must be set via gcloud run services update"
    });
    throw new Error("Missing GCAL_SA_EMAIL / GCAL_SA_PRIVATE_KEY");
  }

  const jwtConfig = {
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
  };

  // If impersonating a user (for domain-wide delegation)
  if (impersonateEmail) {
    jwtConfig.subject = impersonateEmail;
  }

  return new google.auth.JWT(jwtConfig);
}

/**
 * Encode string to base64
 */
function encodeBase64(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

/**
 * Encode string to base64url (RFC 4648)
 */
function encodeBase64Url(str) {
  return encodeBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

/**
 * Send email via Gmail API
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional)
 * @param {string} [options.from] - Sender email (defaults to env var)
 * @param {string} [options.fromName] - Sender name (defaults to "Lake Ride Pros")
 * @param {string} [options.replyTo] - Reply-to address (optional)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail({
  to,
  subject,
  text,
  html = null,
  from = null,
  fromName = "Lake Ride Pros",
  replyTo = null,
}) {
  try {
    if (!to || !subject) {
      throw new Error("Missing required fields: to, subject");
    }

    const senderEmail =
      from || process.env.GMAIL_SENDER || "contactus@lakeridepros.com";

    // Construct MIME message
    const encodedSubject = `=?UTF-8?B?${encodeBase64(subject)}?=`;
    const fromHeader = fromName
      ? `${fromName} <${senderEmail}>`
      : senderEmail;

    const mimeParts = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
    ];

    if (replyTo) {
      mimeParts.push(`Reply-To: ${replyTo}`);
    }

    // If HTML is provided, use multipart/alternative
    if (html) {
      const boundary = `lrp-email-${Date.now()}`;
      mimeParts.push(
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 7bit",
        "",
        text,
        "",
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: 7bit",
        "",
        html,
        "",
        `--${boundary}--`,
      );
    } else {
      // Plain text only
      mimeParts.push(
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 7bit",
        "",
        text,
      );
    }

    const rawMessage = encodeBase64Url(mimeParts.join("\r\n"));

    // Authorize and send
    // Only use domain-wide delegation if explicitly configured
    const useDomainWideDelegation = process.env.GMAIL_USE_DOMAIN_DELEGATION === "true";
    const auth = getGmailJwt(useDomainWideDelegation ? senderEmail : null);
    await auth.authorize();
    const gmail = google.gmail({ version: "v1", auth });

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });

    logger.info("Email sent via Gmail API", {
      to,
      from: senderEmail,
      subject,
      messageId: result.data.id,
    });

    return {
      success: true,
      messageId: result.data.id,
    };
  } catch (error) {
    logger.error("sendEmail error", {
      to,
      subject,
      error: error?.message || error,
      code: error?.code,
    });

    return {
      success: false,
      error: error?.message || "Failed to send email",
    };
  }
}

/**
 * Send email with PNG attachment via Gmail API
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.attachment - Base64-encoded PNG (without data URI prefix)
 * @param {string} options.filename - Attachment filename (e.g., "ticket.png")
 * @param {string} [options.from] - Sender email (defaults to env var)
 * @param {string} [options.fromName] - Sender name
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmailWithAttachment({
  to,
  subject,
  text,
  attachment,
  filename,
  from = null,
  fromName = "Lake Ride Pros",
}) {
  try {
    if (!to || !subject || !attachment || !filename) {
      throw new Error("Missing required fields: to, subject, attachment, filename");
    }

    const senderEmail =
      from || process.env.GMAIL_SENDER || "contactus@lakeridepros.com";

    const boundary = `lrp-attachment-${Date.now()}`;
    const encodedSubject = `=?UTF-8?B?${encodeBase64(subject)}?=`;
    const fromHeader = fromName
      ? `${fromName} <${senderEmail}>`
      : senderEmail;

    // Sanitize and chunk attachment
    const sanitizedAttachment = attachment.replace(/[^A-Za-z0-9+/=]/g, "");
    const chunkedAttachment =
      sanitizedAttachment.match(/.{1,76}/g)?.join("\r\n") ||
      sanitizedAttachment;

    const mimeParts = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      text,
      "",
      `--${boundary}`,
      "Content-Type: image/png",
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      chunkedAttachment,
      "",
      `--${boundary}--`,
      "",
    ];

    const rawMessage = encodeBase64Url(mimeParts.join("\r\n"));

    // Only use domain-wide delegation if explicitly configured
    const useDomainWideDelegation = process.env.GMAIL_USE_DOMAIN_DELEGATION === "true";
    const auth = getGmailJwt(useDomainWideDelegation ? senderEmail : null);
    await auth.authorize();
    const gmail = google.gmail({ version: "v1", auth });

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });

    logger.info("Email with attachment sent via Gmail API", {
      to,
      from: senderEmail,
      subject,
      messageId: result.data.id,
    });

    return {
      success: true,
      messageId: result.data.id,
    };
  } catch (error) {
    logger.error("sendEmailWithAttachment error", {
      to,
      subject,
      error: error?.message || error,
      code: error?.code,
    });

    return {
      success: false,
      error: error?.message || "Failed to send email",
    };
  }
}

module.exports = {
  sendEmail,
  sendEmailWithAttachment,
  getGmailJwt,
};
