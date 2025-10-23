/* Proprietary and confidential. See LICENSE. */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { sendEmailWithAttachment } = require("./gmailHelper");

/**
 * Send bulk shuttle tickets email via Gmail API
 *
 * This function accepts multiple ticket attachments and sends them in a single email.
 * Used by the Tickets page to email selected tickets to customers.
 *
 * @param {Object} data
 * @param {string} data.to - Recipient email address
 * @param {string} data.subject - Email subject line
 * @param {string} data.message - Email body text
 * @param {Array<{filename: string, dataUrl: string}>} data.attachments - Array of PNG attachments
 * @returns {Object} { success: boolean, messageId?: string, error?: string }
 */
const sendBulkTicketsEmail = onCall(
  { region: "us-central1" },
  async (request) => {
    try {
      const { to, subject, message, attachments } = request.data || {};

      // Validate inputs
      if (!to || typeof to !== "string" || !to.includes("@")) {
        throw new HttpsError("invalid-argument", "Missing or invalid recipient email");
      }
      if (!subject || typeof subject !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid subject");
      }
      if (!message || typeof message !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid message");
      }
      if (!Array.isArray(attachments) || attachments.length === 0) {
        throw new HttpsError("invalid-argument", "Missing or invalid attachments array");
      }

      const trimmedEmail = to.trim();

      // For now, send each ticket as a separate email since gmailHelper.sendEmailWithAttachment
      // only supports a single attachment. In the future, we could enhance gmailHelper to support
      // multiple attachments in one email.
      const results = [];
      for (const attachment of attachments) {
        if (!attachment.filename || !attachment.dataUrl) {
          logger.warn("Skipping invalid attachment", { attachment });
          continue;
        }

        // Extract base64 data from data URL (remove "data:image/png;base64," prefix)
        const base64Match = attachment.dataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (!base64Match) {
          logger.warn("Invalid data URL format", { filename: attachment.filename });
          continue;
        }
        const base64Data = base64Match[1];

        const result = await sendEmailWithAttachment({
          to: trimmedEmail,
          subject: `${subject} - ${attachment.filename.replace(/\.png$/i, "")}`,
          text: message,
          attachment: base64Data,
          filename: attachment.filename,
        });

        if (!result.success) {
          logger.error("Failed to send attachment", {
            filename: attachment.filename,
            error: result.error,
          });
        } else {
          results.push(result.messageId);
        }
      }

      if (results.length === 0) {
        throw new HttpsError("internal", "Failed to send any ticket emails");
      }

      logger.info("Bulk ticket emails sent", {
        to: trimmedEmail,
        count: results.length,
        total: attachments.length,
      });

      return {
        success: true,
        messageIds: results,
        sent: results.length,
        total: attachments.length,
      };
    } catch (error) {
      logger.error("sendBulkTicketsEmail error", {
        error: error?.message || error,
        code: error?.code,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to send emails: ${error?.message || "Unknown error"}`,
      );
    }
  },
);

module.exports = { sendBulkTicketsEmail };
