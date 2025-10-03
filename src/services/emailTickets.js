/* LRP Portal enhancement: email tickets via endpoint, 2025-10-03. */
import { AppError, logError } from "@/services/errors";

/** Sends a payload of PNG dataUrls to a server endpoint (POST).
 * Env: VITE_TICKETS_EMAIL_ENDPOINT (optional). If missing, throw AppError.
 * payload: { to, subject, message, attachments: [{ filename, dataUrl }] }
 */
export async function sendTicketsEmail(payload) {
  const url = import.meta.env.VITE_TICKETS_EMAIL_ENDPOINT;
  if (!url)
    throw new AppError("Email endpoint not configured", {
      code: "email_endpoint_missing",
    });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok)
      throw new AppError(`Email request failed ${res.status}`, {
        code: "email_failed",
      });
    return true;
  } catch (err) {
    logError(err, { where: "sendTicketsEmail" });
    throw err;
  }
}
