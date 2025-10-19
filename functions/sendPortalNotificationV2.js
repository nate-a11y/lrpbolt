const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { admin } = require("./_admin");

async function dispatchNotification({ title, body, token }) {
  if (!title) {
    throw new HttpsError("invalid-argument", "title required");
  }

  if (!token) {
    throw new HttpsError("invalid-argument", "device token required");
  }

  try {
    await admin.messaging().send({
      token,
      notification: { title, body: body || "" },
    });
  } catch (error) {
    logger.error("sendPortalNotificationV2:send", error?.message || error);
    throw new HttpsError("internal", error?.message || "notification-failed");
  }
}

const sendPortalNotificationV2 = onCall(async (request) => {
  const payload = request.data || {};

  await dispatchNotification(payload);
  return { ok: true };
});

module.exports = { sendPortalNotificationV2 };
