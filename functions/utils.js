// functions/utils.js
/* Proprietary and confidential. See LICENSE. */
import { admin, db } from "./firebase.js";
import { COLLECTIONS, TIMEZONE } from "./constants.js";

export function formatDate(dateObject) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
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
  await db.collection("claim_failures").add({
    tripId,
    driverName,
    reason,
    attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

const truthy = (v) => {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return Boolean(v);
};
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());

export async function runDailyDrop() {
  const SRC = COLLECTIONS.RIDE_QUEUE;   // source queue (matches index.js)
  const DST = COLLECTIONS.LIVE_RIDES;   // destination used by the client

  // Read both collections
  const [queueSnap, liveSnap] = await Promise.all([
    db.collection(SRC).get(),
    db.collection(DST).get(),
  ]);

  // Nothing to do
  if (queueSnap.empty) {
    await db.collection("AdminMeta").doc("DailyDrop").set(
      { lastUpdated: formatDate(new Date()), imported: 0 },
      { merge: true }
    );
    return { imported: 0, total: liveSnap.size };
  }

  const liveDocs = liveSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const unclaimedLive = liveDocs.filter(
    (r) => !truthy(r.claimedBy) && !truthy(r.claimedAt)
  );
  const existingTripIds = new Set(
    unclaimedLive.map((r) => norm(r.tripId || r.id))
  );

  // Determine starting rideNumber
  let maxRideNum = Math.max(
    0,
    ...unclaimedLive.map((r) => Number(r.rideNumber) || 0)
  );

  // Batch in chunks
  let batch = db.batch();
  let ops = 0;
  let imported = 0;

  for (const qDoc of queueSnap.docs) {
    const q = { id: qDoc.id, ...qDoc.data() };

    // Skip already-claimed queue entries (defensive)
    if (truthy(q.claimedBy) || truthy(q.claimedAt)) continue;

    const key = norm(q.tripId || q.id);
    if (existingTripIds.has(key)) continue; // Already present & unclaimed

    // Upsert into liveRides with same ID; assign rideNumber if missing
    maxRideNum += 1;
    const dstRef = db.collection(DST).doc(qDoc.id);
    batch.set(
      dstRef,
      {
        ...q,
        rideNumber: q.rideNumber ?? maxRideNum,
        status: q.status || "open",
        promotedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Remove from rideQueue
    batch.delete(qDoc.ref);

    ops += 2;
    imported += 1;

    if (ops >= 480) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  await db.collection("AdminMeta").doc("DailyDrop").set(
    { lastUpdated: formatDate(new Date()), imported },
    { merge: true }
  );

  return { imported, total: imported + liveSnap.size };
}
