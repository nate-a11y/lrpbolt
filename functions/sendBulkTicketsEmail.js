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
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 300
  },
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

      // Check total payload size (Firebase callable functions have a ~10MB limit)
      const totalSize = attachments.reduce((sum, att) => sum + (att.dataUrl?.length || 0), 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      logger.info("Payload size check", {
        attachmentCount: attachments.length,
        totalSizeMB,
      });

      if (totalSize > 9 * 1024 * 1024) {  // 9MB threshold for safety
        throw new HttpsError(
          "invalid-argument",
          `Payload too large (${totalSizeMB}MB). Try sending fewer tickets or reducing image quality.`
        );
      }

      // For now, send each ticket as a separate email since gmailHelper.sendEmailWithAttachment
      // only supports a single attachment. In the future, we could enhance gmailHelper to support
      // multiple attachments in one email.
      const results = [];
      const errors = [];

      for (const attachment of attachments) {
        if (!attachment.filename || !attachment.dataUrl) {
          logger.warn("Skipping invalid attachment", { attachment });
          continue;
        }

        // Log data URL details for debugging
        const dataUrlLength = attachment.dataUrl?.length || 0;
        const dataUrlPrefix = attachment.dataUrl?.substring(0, 50) || "";
        logger.info("Processing attachment", {
          filename: attachment.filename,
          dataUrlLength,
          dataUrlPrefix,
        });

        // Extract base64 data from data URL (remove "data:image/png;base64," prefix)
        const base64Match = attachment.dataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (!base64Match) {
          logger.warn("Invalid data URL format", {
            filename: attachment.filename,
            dataUrlLength,
            dataUrlPrefix,
            dataUrlSuffix: attachment.dataUrl?.substring(attachment.dataUrl.length - 50) || "",
          });
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
            to: trimmedEmail,
          });
          errors.push({ filename: attachment.filename, error: result.error });
        } else {
          results.push(result.messageId);
        }
      }

      if (results.length === 0) {
        // Log detailed error information for troubleshooting
        logger.error("All email sends failed", {
          to: trimmedEmail,
          totalAttachments: attachments.length,
          errors: errors,
          hint: "Check GCAL_SA_EMAIL, GCAL_SA_PRIVATE_KEY, and GMAIL_SENDER environment variables",
        });
        throw new HttpsError(
          "internal",
          `Failed to send any ticket emails. ${errors.length > 0 ? `Errors: ${errors.map(e => e.error).join(", ")}` : "Check server logs for details."}`
        );
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
