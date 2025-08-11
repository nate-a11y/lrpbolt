// functions/src/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const { dropDailyFromQueue } = require("./jobs/dropDailyFromQueue");

async function requireAdmin(emailLower) {
  const snap = await db.doc(`userAccess/${emailLower}`).get();
  const access = snap.exists ? String(snap.data().access || "").toLowerCase() : "";
  if (access !== "admin") throw new HttpsError("permission-denied", "Admin only.");
}

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
    console.error("dropDailyRidesNow failed:", err);
    throw new HttpsError("internal", err?.message || "Internal error");
  }
});

// Daily schedule: 7:30 PM Central
exports.scheduleDropDailyRides = onSchedule(
  { region: "us-central1", schedule: "30 19 * * *", timeZone: "America/Chicago" },
  async () => {
    try {
      const cfg = await db.doc("AdminMeta/config").get();
      const dropEnabled = cfg.exists ? cfg.data().dropEnabled !== false : true;
      if (!dropEnabled) { console.log("dropDailyRides skipped by config"); return; }

      const stats = await dropDailyFromQueue({ dryRun: false });
      await db.doc("AdminMeta/lastDropDaily").set(
        { ranAt: admin.firestore.FieldValue.serverTimestamp(), stats, v: 1, trigger: "schedule" },
        { merge: true }
      );
      console.log("dropDailyRides complete", stats);
    } catch (e) {
      console.error("scheduleDropDailyRides error", e);
    }
  }
);

