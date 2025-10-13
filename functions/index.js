/* Proprietary and confidential. See LICENSE. */
const functionsV1 = require("firebase-functions/v1");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { handleSmsOnCreate, TWILIO_SECRETS } = require("./sms/smsOnCreateHandler");

// LRP: Gen-2 global function options (safe defaults)
try {
  // Only call once per process; idempotent across hot reloads.
  setGlobalOptions({
    region: process.env.FUNCTIONS_REGION || "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    concurrency: 80,
    cpu: 1,
  });
} catch (e) {
  // Older firebase-tools in local emulators may not expose v2/options; ignore.
  if (process && process.env && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "v2/options not available in this runtime; continuing without setGlobalOptions",
    );
  }
}

try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn("Admin already initialized:", e && (e.message || e));
}
const db = admin.firestore();
const messagingClient = admin.messaging();

async function hasLiveRides() {
  const snap = await db.collection("liveRides").limit(1).get();
  return !snap.empty;
}

async function ensureNotAlreadySentForToday() {
  const today = new Date().toISOString().slice(0, 10);
  const logRef = db
    .collection("notifications")
    .doc("dailyDrop")
    .collection("days")
    .doc(today);
  const snapshot = await logRef.get();
  if (snapshot.exists) return { already: true };
  await logRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { already: false, logRef };
}

function buildDailyDropMessage() {
  const title = "Lake Ride Pros";
  const body = "New Rides Have Dropped in the Portal";
  const imageUrl = "https://lakeridepros.xyz/android-chrome-192x192.png";
  const clickLink = "https://lakeridepros.xyz/tickets?tab=live";
  const topic = "allUsers";

  return {
    topic,
    notification: { title, body, imageUrl },
    data: { kind: "daily-drop", deeplink: clickLink },
    android: { priority: "high", notification: { imageUrl } },
    apns: {
      payload: { aps: { sound: "default" } },
      fcm_options: { image: imageUrl },
    },
    webpush: {
      fcmOptions: { link: clickLink },
      notification: { image: imageUrl },
    },
  };
}

const { dropDailyFromQueue } = require("./src/jobs/dropDailyFromQueue");
const { ensureLiveRideOpen } = require("./ensureLiveOpen");

exports.smsOnCreate = functionsV1
  .region("us-central1")
  .firestore.document("outboundMessages/{id}")
  .onCreate(async (snap, context) => {
    try {
      const data = (snap && snap.data()) || null;
      const docPath = snap?.ref?.path || `outboundMessages/${context?.params?.id}`;
      const meta = {
        docId: context?.params?.id,
        docPath,
        eventId: context?.eventId,
        createTime: snap?.createTime,
      };
      await handleSmsOnCreate(data, meta);
      return null;
    } catch (e) {
      logger.error("smsOnCreate (v1) failed", {
        err: e && (e.stack || e.message || e),
      });
      throw e;
    }
  });

exports.smsOnCreateV2 = onDocumentCreated(
  {
    document: "outboundMessages/{id}",
    region: "us-central1",
    secrets: TWILIO_SECRETS,
  },
  async (event) => {
    try {
      const after = event?.data?.data() || null;
      const docPath =
        event?.data?.ref?.path || `outboundMessages/${event?.params?.id}`;
      const meta = {
        docId: event?.params?.id,
        docPath,
        eventId: event?.id,
        createTime: event?.time,
      };
      await handleSmsOnCreate(after, meta);
      return null;
    } catch (e) {
      logger.error("smsOnCreateV2 (v2) failed", {
        err: e && (e.stack || e.message || e),
      });
      throw e;
    }
  }
);

exports.ensureLiveRideOpen = ensureLiveRideOpen;

async function requireAdmin(emailLower) {
  const snap = await db.doc(`userAccess/${emailLower}`).get();
  const access = snap.exists
    ? String(snap.data().access || "").toLowerCase()
    : "";
  if (access !== "admin")
    throw new HttpsError("permission-denied", "Admin only.");
}

exports.sendPortalNotification = onCall(async (req) => {
  const authEmail = req.auth?.token?.email || "unknown";
  const { title, body, icon, data, email, token, topic } = req.data || {};
  if (!title) throw new HttpsError("invalid-argument", "title required");

  // Admin check via userAccess
  const snap = await admin.firestore().doc(`userAccess/${authEmail}`).get();
  const access = (snap.data()?.access || "").toLowerCase();
  if (access !== "admin")
    throw new HttpsError("permission-denied", "Admin only.");

  const base = {
    notification: { title, body },
    webpush: {
      notification: { icon: icon || "/icons/icon-192x192.png" },
      data: data || {},
    },
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
          const qs = await db
            .collection("fcmTokens")
            .where("token", "==", token)
            .get();
          await Promise.all(
            qs.docs.map((d) => d.ref.delete().catch(() => undefined)),
          );
          logger.info("Removed invalid token");
          return { ok: true, count: 0 };
        }
        throw err;
      }
    }
    if (email) {
      const qs = await db
        .collection("fcmTokens")
        .where("email", "==", email)
        .get();
      const tokens = qs.docs.map((d) => d.data().token).filter(Boolean);
      if (tokens.length === 0) return { ok: true, count: 0 };
      const results = await Promise.allSettled(
        tokens.map((t) => messaging.send({ ...base, token: t })),
      );
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
          await db
            .collection("fcmTokens")
            .doc(docId)
            .delete()
            .catch(() => undefined);
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

exports.dropDailyRidesNow = onCall({ region: "us-central1" }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const email = String(req.auth.token.email || "").toLowerCase();
  await requireAdmin(email);

  try {
    const dryRun = !!(req.data && req.data.dryRun);
    const stats = await dropDailyFromQueue({ dryRun });
    return { ok: true, dryRun, stats };
  } catch (err) {
    logger.error("dropDailyRidesNow failed", { err });
    throw new HttpsError("internal", err?.message || "Internal error");
  }
});

exports.dailyDropIfLiveRides = onSchedule(
  {
    region: "us-central1",
    schedule: "0 20 * * *",
    timeZone: "America/Chicago",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    try {
      const { already } = await ensureNotAlreadySentForToday();
      if (already) {
        logger.info("Already sent daily drop today, skipping.");
        return;
      }

      const exists = await hasLiveRides();
      if (!exists) {
        logger.info("No live rides found, skipping push.");
        return;
      }

      const message = buildDailyDropMessage();
      const id = await messagingClient.send(message);
      logger.info("Daily Drop sent successfully:", id);
    } catch (err) {
      logger.error("dailyDropIfLiveRides failed", { err });
      throw err;
    }
  },
);

exports.sendDailySms = onSchedule(
  {
    region: "us-central1",
    schedule: "0 14 * * *",
    timeZone: "America/Chicago",
  },
  async () => {
    try {
      await db.collection("outboundMessages").add({
        to: "+15733532849",
        body: "Hey Jim 👋 don’t forget to check the rides in Moovs, charge the deposits 💳, and add everything into the portal 📲✅.",
        channel: "sms",
        status: "queued",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("sendDailySms queued");
    } catch (err) {
      logger.error("sendDailySms error", { err });
    }
  },
);

exports.scheduleDropDailyRides = onSchedule(
  {
    region: "us-central1",
    schedule: "30 19 * * *",
    timeZone: "America/Chicago",
  },
  async () => {
    try {
      const cfg = await db.doc("AdminMeta/config").get();
      const dropEnabled = cfg.exists ? cfg.data().dropEnabled !== false : true;
      if (!dropEnabled) {
        logger.info("dropDailyRides skipped by config");
        return;
      }

      const stats = await dropDailyFromQueue({ dryRun: false });
      await db
        .doc("AdminMeta/lastDropDaily")
        .set(
          {
            ranAt: admin.firestore.FieldValue.serverTimestamp(),
            stats,
            v: 1,
            trigger: "schedule",
          },
          { merge: true },
        );
      logger.info("dropDailyRides complete", stats);
    } catch (e) {
      logger.error("scheduleDropDailyRides error", { err: e });
    }
  },
);
