const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { admin } = require("../admin");
const { corsMiddleware } = require("../cors");
const { COLLECTIONS } = require("../constants");

// Server-only token for CI/manual calls (set via GitHub Secrets)
const MANUAL_DROP_TOKEN = process.env.MANUAL_DROP_TOKEN || ""; // TODO: move to Secret Manager

async function isAdminUser(req) {
  const auth = req.headers.authorization || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return false;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase();
    const ref = admin.firestore().doc(`${COLLECTIONS.USER_ACCESS}/${email}`);
    const snap = await ref.get();
    return snap.exists && (snap.data().access || "").toLowerCase() === "admin";
  } catch (e) {
    logger.warn("isAdminUser verify failed", e);
    return false;
  }
}

async function dropDailyRidesCore() {
  const db = admin.firestore();
  const today = new Date();
  today.setHours(0,0,0,0);

  // Example: archive rides older than today
  const q = await db.collection("rides")
    .where("rideDate", "<", admin.firestore.Timestamp.fromDate(today))
    .get();

  let count = 0;
  const batch = db.batch();
  q.forEach(doc => {
    batch.update(doc.ref, {
      archived: true,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  });
  if (count) await batch.commit();
  return { archivedCount: count };
}

exports.dropDailyRidesNow = onRequest(
  { region: "us-central1", timeoutSeconds: 120, memory: "256MiB", concurrency: 10, maxInstances: 5 },
  async (req, res) => {
    corsMiddleware(req, res, async () => {
      try {
        if (req.method === "OPTIONS") return res.status(204).send("");

        const headerToken = req.get("X-Auth-Token") || "";
        const adminOk = await isAdminUser(req);
        const serverTokenOk = MANUAL_DROP_TOKEN && headerToken === MANUAL_DROP_TOKEN;

        if (!(adminOk || serverTokenOk)) {
          logger.warn("Unauthorized drop attempt");
          return res.status(401).json({ ok: false, error: "unauthorized" });
        }

        logger.info("[dropDailyRidesNow] start");
        const result = await dropDailyRidesCore();
        logger.info("[dropDailyRidesNow] done", result);
        return res.status(200).json({ ok: true, ...result });
      } catch (err) {
        logger.error("dropDailyRidesNow failed", err);
        return res.status(500).json({ ok: false, error: err.message || "Internal error" });
      }
    });
  }
);

// Scheduled daily at 03:30 America/Chicago
exports.dropDailyRidesDaily = onSchedule(
  { region: "us-central1", schedule: "30 3 * * *", timeZone: "America/Chicago", retryCount: 0 },
  async (event) => {
    logger.info("[dropDailyRidesDaily] cron start", { eventId: event.id });
    const result = await dropDailyRidesCore();
    logger.info("[dropDailyRidesDaily] cron done", result);
  }
);
