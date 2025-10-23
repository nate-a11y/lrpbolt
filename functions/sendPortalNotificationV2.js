const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");

const { admin } = require("./_admin");

async function lookupTokensByEmail(db, email) {
  const tokens = [];
  try {
    const snap = await db.collection("fcmTokens").where("email", "==", email).get();
    snap.forEach((doc) => {
      const token = doc.data()?.token || doc.id;
      if (token) tokens.push({ token: String(token), docId: doc.id });
    });
  } catch (error) {
    logger.warn("sendPortalNotificationV2:lookupTokensByEmail", {
      email,
      err: error?.message || error,
    });
  }
  return tokens;
}

function isInvalidTokenError(error) {
  const code = error?.code || error?.errorInfo?.code || "";
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument" ||
    error?.message?.includes("Requested entity was not found")
  );
}

async function dispatchNotification({ title, body, token, icon, data, docId, db }) {
  if (!title) {
    throw new HttpsError("invalid-argument", "title required");
  }

  if (!token) {
    throw new HttpsError("invalid-argument", "device token required");
  }

  try {
    const message = {
      token,
      notification: {
        title,
        body: body || "",
      },
    };

    // Add icon to notification if provided
    if (icon) {
      message.notification.icon = icon;
    }

    // Add custom data fields if provided
    if (data && typeof data === "object") {
      message.data = {};
      Object.keys(data).forEach((key) => {
        message.data[key] = String(data[key]);
      });
    }

    await admin.messaging().send(message);
    return { success: true };
  } catch (error) {
    const isInvalid = isInvalidTokenError(error);

    if (isInvalid) {
      logger.info("sendPortalNotificationV2:invalidToken", {
        token: token.substring(0, 20) + "...",
        docId,
        error: error?.message || error,
      });

      // Clean up invalid token from database
      if (db && docId) {
        try {
          await db.collection("fcmTokens").doc(docId).delete();
          logger.info("sendPortalNotificationV2:tokenDeleted", { docId });
        } catch (cleanupError) {
          logger.warn("sendPortalNotificationV2:tokenDeleteFailed", {
            docId,
            error: cleanupError?.message || cleanupError,
          });
        }
      }

      return { success: false, invalidToken: true, error: error?.message || "Invalid token" };
    }

    logger.error("sendPortalNotificationV2:send", {
      error: error?.message || error,
      code: error?.code || error?.errorInfo?.code,
    });
    return { success: false, error: error?.message || "notification-failed" };
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
    const message = {
      topic,
      notification: {
        title,
        body: body || "",
      },
    };

    // Add icon to notification if provided
    if (icon) {
      message.notification.icon = icon;
    }

    // Add custom data fields if provided
    if (data && typeof data === "object") {
      message.data = {};
      Object.keys(data).forEach((key) => {
        message.data[key] = String(data[key]);
      });
    }

    await admin.messaging().send(message);
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
    const result = await dispatchNotification({ title, body, token, icon: iconUrl, data });
    if (!result.success) {
      throw new HttpsError("internal", result.error || "notification-failed");
    }
    return { ok: true, count: 1 };
  }

  // Handle email-based sending (lookup tokens)
  if (email) {
    const db = admin.firestore();
    const tokenDocs = await lookupTokensByEmail(db, email);

    if (tokenDocs.length === 0) {
      logger.warn("sendPortalNotificationV2:noTokensFound", { email });
      return { ok: true, count: 0, message: "No FCM tokens found for this email" };
    }

    // Use Promise.allSettled to handle partial failures gracefully
    const results = await Promise.allSettled(
      tokenDocs.map(({ token: t, docId }) =>
        dispatchNotification({ title, body, token: t, icon: iconUrl, data, docId, db }),
      ),
    );

    // Count successes and failures
    let succeeded = 0;
    let invalidTokens = 0;
    let failed = 0;

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const value = result.value;
        if (value.success) {
          succeeded++;
        } else if (value.invalidToken) {
          invalidTokens++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    });

    logger.info("sendPortalNotificationV2:complete", {
      email,
      total: tokenDocs.length,
      succeeded,
      invalidTokens,
      failed,
    });

    return {
      ok: true,
      count: succeeded,
      total: tokenDocs.length,
      invalidTokens,
      failed,
    };
  }

  throw new HttpsError(
    "invalid-argument",
    "Must provide email, token, or topic",
  );
});

module.exports = { sendPortalNotificationV2 };
