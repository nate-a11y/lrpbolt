/* Proprietary and confidential. See LICENSE. */
// functions/utils.js

import admin from "firebase-admin";

export function formatDate(dateObject) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour12: true,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(dateObject);
}

export function normalizeHeader(header) {
  return header
    .toString()
    .trim()
    .replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toLowerCase());
}

export async function logClaimFailure(tripId, driverName, reason) {
  const db = admin.firestore();
  await db.collection("FailedClaims").add({
    tripId,
    driverName,
    reason,
    attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function runDailyDrop() {
  const db = admin.firestore();
  const normalize = (val) => val?.toString().trim().toLowerCase() || "";

  const queueSnap = await db.collection("RideQueue").get();
  const liveSnap = await db.collection("RidesLive").get();

  if (queueSnap.empty || liveSnap.empty) {
    throw new Error("Missing RideQueue or RidesLive collection");
  }

  const queueRides = queueSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const liveRides = liveSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const claimedLive = liveRides.filter(
    (r) => normalize(r.claimedBy) && normalize(r.claimedAt),
  );
  const unclaimedLive = liveRides.filter(
    (r) => !normalize(r.claimedBy) && !normalize(r.claimedAt),
  );
  const existingTripIDs = unclaimedLive.map((r) => normalize(r.tripId));

  const newQueueRides = queueRides.filter(
    (r) =>
      !normalize(r.claimedBy) &&
      !normalize(r.claimedAt) &&
      !existingTripIDs.includes(normalize(r.tripId)),
  );

  const maxId = Math.max(
    0,
    ...unclaimedLive.map((r) => parseInt(r.rideNumber) || 0),
  );
  newQueueRides.forEach((r, idx) => (r.rideNumber = maxId + idx + 1));

  const combined = [...unclaimedLive, ...claimedLive, ...newQueueRides].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  const batch = db.batch();
  liveSnap.docs.forEach((doc) => batch.delete(doc.ref));
  combined.forEach((r) => {
    const ref = db.collection("RidesLive").doc();
    batch.set(ref, r);
  });

  queueSnap.docs.forEach((doc) => batch.delete(doc.ref));

  batch.set(db.collection("AdminMeta").doc("DailyDrop"), {
    lastUpdated: formatDate(new Date()),
  });

  await batch.commit();

  return { imported: newQueueRides.length, total: combined.length };
}

