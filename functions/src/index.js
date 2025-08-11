/* Proprietary and confidential. See LICENSE. */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Guard to avoid "The default Firebase app already exists"
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();

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
 * TODO: Move any embedded secrets to Google Secret Manager.  <-- leave for now per instruction
 */
export const dropDailyRidesNow = onCall(
  {
    region: "us-central1",
    // If App Check is enabled on the client and you want enforcement here, set true:
    // enforceAppCheck: true,
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");

    const email = (req.auth?.token?.email || "").toLowerCase();
    if (!email) throw new HttpsError("permission-denied", "Email required.");

    // Role check via userAccess collection
    const doc = await db.doc(`userAccess/${email}`).get();
    const access = (doc.exists ? (doc.data()?.access || "") : "").toString().toLowerCase();
    if (access !== "admin") {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    try {
      // === BEGIN your job logic ===
      // Implement or call your existing job logic here. Keep it idempotent.
      await dropDailyRidesCore();
      // === END job logic ===

      return { ok: true, at: Date.now() };
    } catch (err) {
      console.error("dropDailyRidesNow failed:", err);
      throw new HttpsError("internal", err?.message || "Internal error");
    }
  }
);

export const dropDailyRidesDaily = onSchedule(
  { region: "us-central1", schedule: "30 3 * * *", timeZone: "America/Chicago", retryCount: 0 },
  async (event) => {
    logger.info("[dropDailyRidesDaily] cron start", { eventId: event.id });
    const result = await dropDailyRidesCore();
    logger.info("[dropDailyRidesDaily] cron done", result);
  }
);
