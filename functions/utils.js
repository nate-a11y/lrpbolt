// functions/utils.js
import admin from "firebase-admin";
const db = admin.firestore();

const truthy = (v) => {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return Boolean(v);
};
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());

export async function runDailyDrop() {
  const SRC = "RideQueue";   // current queue collection (what your index.js uses)
  const DST = "liveRides";   // <-- match the client listener name

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

  // Build sets of existing, unclaimed trip IDs in live
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

    // Skip anything already claimed in queue (shouldn't be there, but be safe)
    if (truthy(q.claimedBy) || truthy(q.claimedAt)) continue;

    const key = norm(q.tripId || q.id);
    if (existingTripIds.has(key)) continue; // Already in live & unclaimed

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

    // Remove from queue
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
    {
      lastUpdated: formatDate(new Date()),
      imported,
    },
    { merge: true }
  );

  // Report back
  return { imported, total: imported + liveSnap.size };
}
