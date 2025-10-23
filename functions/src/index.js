// functions/src/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
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

