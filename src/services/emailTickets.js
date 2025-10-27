/* LRP Portal enhancement: email tickets via endpoint, 2025-10-03. */
import { httpsCallable } from "firebase/functions";

import { AppError, logError } from "@/services/errors";
import { getLRPFunctions } from "@/utils/functions";

/** Sends a payload of PNG dataUrls to Firebase callable function.
 * Uses Firebase callable function instead of direct HTTP endpoint.
 * payload: { to, subject, message, attachments: [{ filename, dataUrl }] }
 */
export async function sendTicketsEmail(payload) {
  try {
    const sendBulkEmail = httpsCallable(
      getLRPFunctions(),
      "sendBulkTicketsEmail",
    );
    const result = await sendBulkEmail(payload);
    return result.data;
  } catch (err) {
    logError(err, { where: "sendTicketsEmail" });

    // Provide more specific error messages based on the error type
    let errorMessage = "Email service unavailable";

    if (err?.code === "unauthenticated") {
      errorMessage = "Authentication failed - please sign in again";
    } else if (err?.code === "permission-denied") {
      errorMessage = "You don't have permission to send emails";
    } else if (err?.code === "unavailable" || err?.code === "internal") {
      errorMessage = "Email service is temporarily unavailable";
    } else if (err?.message?.includes("Failed to send any ticket emails")) {
      errorMessage = "Email delivery failed - check Gmail API configuration";
    } else if (err?.message) {
      errorMessage = err.message;
    }

    throw new AppError(errorMessage, {
      code: "email_failed",
      originalError: err?.message,
    });
  }
}
