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
    throw new AppError(err?.message || "Failed to send bulk tickets email", {
      code: "email_failed",
    });
  }
}
