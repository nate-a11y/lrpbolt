/* Proprietary and confidential. See LICENSE. */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { sendEmailWithAttachment } = require("./gmailHelper");

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
      const subject = `Lake Ride Pros Shuttle Ticket ${ticketId}`;
      const text = `Attached is your Lake Ride Pros shuttle ticket ${ticketId}. Please present it during boarding.`;

      const result = await sendEmailWithAttachment({
        to: trimmedEmail,
        subject,
        text,
        attachment,
        filename: `${ticketId}.png`,
      });

      if (!result.success) {
        throw new HttpsError("internal", result.error || "Failed to send email");
      }

      logger.info("Shuttle ticket email sent", {
        ticketId,
        to: trimmedEmail,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
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
