/* Proprietary and confidential. See LICENSE. */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

try { admin.initializeApp(); } catch { /* hot-reload safe */ }

exports.sendPortalNotification = onCall(async (req) => {
  const authEmail = req.auth?.token?.email || "unknown";
  const { title, body, icon, data, email, token, topic } = req.data || {};
  if (!title) throw new HttpsError("invalid-argument", "title required");

  // Admin check via userAccess
  const snap = await admin.firestore().doc(`userAccess/${authEmail}`).get();
  const access = (snap.data()?.access || "").toLowerCase();
  if (access !== "admin") throw new HttpsError("permission-denied", "Admin only.");

  const base = {
    notification: { title, body },
    webpush: { notification: { icon: icon || "/icons/icon-192x192.png" }, data: data || {} },
  };

  try {
    const messaging = admin.messaging();
    const db = admin.firestore();
    if (token) {
      try {
        await messaging.send({ ...base, token });
        logger.info("Sent to token");
        return { ok: true, count: 1 };
      } catch (err) {
        if (
          err?.code === "messaging/registration-token-not-registered" ||
          err?.message?.includes("Requested entity was not found")
        ) {
          const qs = await db.collection("fcmTokens").where("token", "==", token).get();
          await Promise.all(qs.docs.map((d) => d.ref.delete().catch(() => undefined)));
          logger.info("Removed invalid token");
          return { ok: true, count: 0 };
        }
        throw err;
      }
    }
    if (email) {
      const qs = await db.collection("fcmTokens").where("email", "==", email).get();
      const tokens = qs.docs.map((d) => d.data().token).filter(Boolean);
      if (tokens.length === 0) return { ok: true, count: 0 };
      const results = await Promise.allSettled(tokens.map((t) => messaging.send({ ...base, token: t })));
      let count = 0;
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === "fulfilled") {
          count++;
          continue;
        }
        const err = res.reason;
        if (
          err?.code === "messaging/registration-token-not-registered" ||
          err?.message?.includes("Requested entity was not found")
        ) {
          const t = tokens[i];
          const docId = `${email}__${t.slice(0, 16)}`;
          await db.collection("fcmTokens").doc(docId).delete().catch(() => undefined);
          continue;
        }
        throw err;
      }
      return { ok: true, count };
    }
    if (topic) {
      await messaging.send({ ...base, topic });
      return { ok: true, count: 1 };
    }
    throw new HttpsError("invalid-argument", "Provide token, email, or topic.");
  } catch (err) {
    logger.error("sendPortalNotification error", err);
    throw new HttpsError("internal", err.message || "send error");
  }
});
