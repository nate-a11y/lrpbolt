/* Proprietary and confidential. See LICENSE. */
const { google } = require("googleapis");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

/**
 * Get JWT auth client using service account credentials
 * Same service account as calendar, but with Gmail send scope
 */
function getGmailJwt() {
  const email = process.env.GCAL_SA_EMAIL;
  const key = (process.env.GCAL_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Missing GCAL_SA_EMAIL / GCAL_SA_PRIVATE_KEY");
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
  });
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
 * Send shuttle ticket email via Gmail API
 *
 * @param {Object} data
 * @param {string} data.ticketId - Ticket ID
 * @param {string} data.email - Recipient email address
 * @param {string} data.attachment - Base64-encoded PNG image (without data:image/png;base64, prefix)
 * @returns {Object} { success: boolean, messageId?: string, error?: string }
 */
const sendShuttleTicketEmail = onCall(
  { region: "us-central1" },
  async (request) => {
    try {
      const { ticketId, email, attachment } = request.data || {};

      // Validate inputs
      if (!ticketId || typeof ticketId !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid ticketId");
      }
      if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new HttpsError("invalid-argument", "Missing or invalid email");
      }
      if (!attachment || typeof attachment !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid attachment");
      }

      const trimmedEmail = email.trim();
      const sender = process.env.GMAIL_SENDER || "noreply@lakeridepros.com";

      // Construct MIME message
      const boundary = `lrp-ticket-${Date.now()}`;
      const subjectText = `Lake Ride Pros Shuttle Ticket ${ticketId}`;
      const encodedSubject = `=?UTF-8?B?${encodeBase64(subjectText)}?=`;
      const bodyText =
        `Attached is your Lake Ride Pros shuttle ticket ${ticketId}. Please present it during boarding.`;

      // Sanitize and chunk attachment for proper MIME formatting
      const sanitizedAttachment = attachment.replace(/[^A-Za-z0-9+/=]/g, "");
      const chunkedAttachment = sanitizedAttachment.match(/.{1,76}/g)?.join("\r\n") || sanitizedAttachment;

      const mimeParts = [
        `From: Lake Ride Pros <${sender}>`,
        `To: ${trimmedEmail}`,
        `Subject: ${encodedSubject}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 7bit",
        "",
        bodyText,
        "",
        `--${boundary}`,
        "Content-Type: image/png",
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${ticketId}.png"`,
        "",
        chunkedAttachment,
        "",
        `--${boundary}--`,
        "",
      ];

      const rawMessage = encodeBase64Url(mimeParts.join("\r\n"));

      // Authorize and send
      const auth = getGmailJwt();
      await auth.authorize();
      const gmail = google.gmail({ version: "v1", auth });

      const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: rawMessage,
        },
      });

      logger.info("Shuttle ticket email sent", {
        ticketId,
        to: trimmedEmail,
        messageId: result.data.id,
      });

      return {
        success: true,
        messageId: result.data.id,
      };
    } catch (error) {
      logger.error("sendShuttleTicketEmail error", {
        error: error?.message || error,
        code: error?.code,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to send email: ${error?.message || "Unknown error"}`,
      );
    }
  },
);

module.exports = { sendShuttleTicketEmail };
