const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");

const { admin } = require("./_admin");

async function lookupTokensByEmail(db, email) {
  const tokens = [];
  try {
    const snap = await db.collection("fcmTokens").where("email", "==", email).get();
    snap.forEach((doc) => {
      const token = doc.data()?.token || doc.id;
      if (token) tokens.push(String(token));
    });
  } catch (error) {
    logger.warn("sendPortalNotificationV2:lookupTokensByEmail", {
      email,
      err: error?.message || error,
    });
  }
  return tokens;
}

async function dispatchNotification({ title, body, token, icon, data }) {
  if (!title) {
    throw new HttpsError("invalid-argument", "title required");
  }

  if (!token) {
    throw new HttpsError("invalid-argument", "device token required");
  }

  try {
    const messageData = {
      title,
      body: body || "",
    };

    // Add custom data fields if provided
    if (data && typeof data === "object") {
      Object.keys(data).forEach((key) => {
        if (key !== "title" && key !== "body") {
          messageData[key] = String(data[key]);
        }
      });
    }

    // Add icon if provided
    if (icon) {
      messageData.icon = icon;
    }

    await admin.messaging().send({
      token,
      data: messageData,
    });
  } catch (error) {
    logger.error("sendPortalNotificationV2:send", error?.message || error);
    throw new HttpsError("internal", error?.message || "notification-failed");
  }
}

async function sendToTopic({ title, body, topic, icon, data }) {
  if (!title) {
    throw new HttpsError("invalid-argument", "title required");
  }

  if (!topic) {
    throw new HttpsError("invalid-argument", "topic required");
  }

  try {
    const messageData = {
      title,
      body: body || "",
    };

    // Add custom data fields if provided
    if (data && typeof data === "object") {
      Object.keys(data).forEach((key) => {
        if (key !== "title" && key !== "body") {
          messageData[key] = String(data[key]);
        }
      });
    }

    // Add icon if provided
    if (icon) {
      messageData.icon = icon;
    }

    await admin.messaging().send({
      topic,
      data: messageData,
    });
  } catch (error) {
    logger.error("sendPortalNotificationV2:sendToTopic", error?.message || error);
    throw new HttpsError("internal", error?.message || "notification-failed");
  }
}

const sendPortalNotificationV2 = onCall(async (request) => {
  const payload = request.data || {};
  const { email, token, topic, title, body, iconUrl, data } = payload;

  // Handle topic-based sending
  if (topic) {
    await sendToTopic({ title, body, topic, icon: iconUrl, data });
    return { ok: true, count: 1 };
  }

  // Handle direct token sending
  if (token) {
    await dispatchNotification({ title, body, token, icon: iconUrl, data });
    return { ok: true, count: 1 };
  }

  // Handle email-based sending (lookup tokens)
  if (email) {
    const db = admin.firestore();
    const tokens = await lookupTokensByEmail(db, email);

    if (tokens.length === 0) {
      logger.warn("sendPortalNotificationV2:noTokensFound", { email });
      return { ok: true, count: 0 };
    }

    await Promise.all(
      tokens.map((t) =>
        dispatchNotification({ title, body, token: t, icon: iconUrl, data }),
      ),
    );
    return { ok: true, count: tokens.length };
  }

  throw new HttpsError(
    "invalid-argument",
    "Must provide email, token, or topic",
  );
});

module.exports = { sendPortalNotificationV2 };
