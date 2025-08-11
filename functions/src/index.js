/* Proprietary and confidential. See LICENSE. */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function dropDailyRidesCore() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const q = await db
    .collection("rides")
    .where("rideDate", "<", admin.firestore.Timestamp.fromDate(today))
    .get();

  let count = 0;
  const batch = db.batch();
  q.forEach((doc) => {
    batch.update(doc.ref, {
      archived: true,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  });
  if (count) await batch.commit();
  return { archivedCount: count };
}

/**
 * Callable admin-only task to drop/rollover daily rides.
 * TODO: Move any embedded secrets to Secret Manager (left in place for now).
 */
exports.dropDailyRidesNow = onCall(
  {
    region: "us-central1",
    // If App Check is configured on the client and you want enforcement:
    // enforceAppCheck: true,
  },
  async (req) => {
    const uid = req.auth && req.auth.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");

    const email = ((req.auth.token.email || "") + "").toLowerCase();
    if (!email) throw new HttpsError("permission-denied", "Email required.");

    // Role check (userAccess/{email}.access === "admin")
    const ref = db.doc(`userAccess/${email}`);
    const snap = await ref.get();
    const access = snap.exists ? String(snap.data().access || "").toLowerCase() : "";
    if (access !== "admin") {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    try {
      // === BEGIN your job logic ===
      await dropDailyRidesCore();
      // === END your job logic ===
      return { ok: true, at: Date.now() };
    } catch (err) {
      console.error("dropDailyRidesNow failed:", err);
      const msg = err && err.message ? err.message : "Internal error";
      throw new HttpsError("internal", msg);
    }
  }
);

exports.dropDailyRidesDaily = onSchedule(
  { region: "us-central1", schedule: "30 3 * * *", timeZone: "America/Chicago", retryCount: 0 },
  async (event) => {
    logger.info("[dropDailyRidesDaily] cron start", { eventId: event.id });
    const result = await dropDailyRidesCore();
    logger.info("[dropDailyRidesDaily] cron done", result);
  }
);
