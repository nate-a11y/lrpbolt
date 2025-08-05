/* Proprietary and confidential. See LICENSE. */
// functions/index.js

import functions from "firebase-functions";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Helper: normalize values
const normalize = (val) => val?.toString().trim().toLowerCase() || "";

export async function runDailyDrop() {
  const queueSnap = await db.collection("RideQueue").get();
  const liveSnap = await db.collection("RidesLive").get();

  if (queueSnap.empty || liveSnap.empty) {
    throw new Error("Missing RideQueue or RidesLive collection");
  }

  const queueRides = queueSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const liveRides = liveSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Split live rides
  const claimedLive = liveRides.filter(
    (r) => normalize(r.claimedBy) && normalize(r.claimedAt),
  );
  const unclaimedLive = liveRides.filter(
    (r) => !normalize(r.claimedBy) && !normalize(r.claimedAt),
  );
  const existingTripIDs = unclaimedLive.map((r) => normalize(r.tripId));

  // Filter new queue rides
  const newQueueRides = queueRides.filter(
    (r) =>
      !normalize(r.claimedBy) &&
      !normalize(r.claimedAt) &&
      !existingTripIDs.includes(normalize(r.tripId)),
  );

  // Assign ride numbers
  const maxId = Math.max(
    0,
    ...unclaimedLive.map((r) => parseInt(r.rideNumber) || 0),
  );
  newQueueRides.forEach((r, idx) => (r.rideNumber = maxId + idx + 1));

  // Merge all rides and sort by date
  const combined = [...unclaimedLive, ...claimedLive, ...newQueueRides].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  // Batch update
  const batch = db.batch();
  liveSnap.docs.forEach((doc) => batch.delete(doc.ref));
  combined.forEach((r) => {
    const ref = db.collection("RidesLive").doc();
    batch.set(ref, r);
  });

  queueSnap.docs.forEach((doc) => batch.delete(doc.ref));

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
  });
  batch.set(db.collection("AdminMeta").doc("DailyDrop"), {
    lastUpdated: timestamp,
  });

  await batch.commit();

  return { imported: newQueueRides.length, total: combined.length };
}

export const dropDailyRides = functions.pubsub
  .schedule("0 18 * * *") // 6 PM CST
  .timeZone("America/Chicago")
  .onRun(async () => {
    try {
      const { imported, total } = await runDailyDrop();
      await sendEmail(
        "✅ Daily Rides Updated",
        `Imported from queue: ${imported}\nTotal rides active: ${total}`,
      );
      return null;
    } catch (err) {
      await sendEmail("❌ Daily Drop Error", err.message);
      throw err;
    }
  });

export const dropDailyRidesNow = functions.https.onCall(
  async (data, context) => {
    try {
      const { imported, total } = await runDailyDrop();
      await sendEmail(
        "✅ Daily Rides Updated",
        `Imported from queue: ${imported}\nTotal rides active: ${total}`,
      );
      return {
        success: true,
        message: "✅ Daily drop executed",
        imported,
        total,
      };
    } catch (error) {
      await sendEmail("❌ Daily Drop Error", error.message);
      throw new functions.https.HttpsError("internal", error.message);
    }
  },
);

// Helper to send Trigger Email
async function sendEmail(subject, body) {
  const mailRef = db.collection("_mail").doc();
  await mailRef.set({
    to: [
      "nate@lakeridepros.com",
      "michael@lakeridepros.com",
      "jim@lakeridepros.com",
    ],
    message: { subject, text: body },
  });
}
