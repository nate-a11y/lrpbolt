// functions/src/jobs/dropDailyFromQueue.js
const admin = require("firebase-admin");
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const normTs = (v) => {
  if (!v) return null;
  if (v instanceof Timestamp) return v;
  if (v.toDate) return Timestamp.fromDate(v.toDate());
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
};

function normalizeRide(raw = {}) {
  const tripId = String(raw.tripId ?? raw.TripID ?? "").trim();
  const pickupTime = normTs(raw.pickupTime ?? raw.Date ?? null);
  const claimedBy = raw.claimedBy ?? raw.ClaimedBy ?? null;
  const claimedAt  = normTs(raw.claimedAt ?? raw.ClaimedAt ?? null);
  const rideDuration = typeof raw.rideDuration === "number"
    ? raw.rideDuration
    : raw.rideDuration != null ? Number(raw.rideDuration) : null;
  return { ...raw, tripId, pickupTime, claimedBy, claimedAt, rideDuration };
}

const isUnclaimed = (doc) => {
  const d = normalizeRide(doc);
  return !d.claimedBy && !d.claimedAt;
};

async function collectLiveTripIds() {
  const snap = await db.collection("liveRides").get();
  const ids = new Set();
  let liveUnclaimed = 0;
  for (const doc of snap.docs) {
    const data = normalizeRide(doc.data());
    ids.add(String(doc.id).trim());
    if (data.tripId) ids.add(String(data.tripId).trim());
    if (isUnclaimed(data)) liveUnclaimed += 1;
  }
  return { ids, liveDocs: snap.size, liveUnclaimed };
}

/**
 * Behavior:
 * - Read all Live; duplicates are not allowed (claimed or unclaimed).
 * - From rideQueue, take ONLY unclaimed; require TripID; skip if duplicate.
 * - Copy ALL fields to liveRides with docId = TripID (create).
 * - Clear ALL docs in rideQueue.
 * - Write AdminMeta/lastDropDaily with stats.
 */
async function dropDailyFromQueue({ dryRun = false } = {}) {
  const stats = {
    liveDocs: 0, liveUnclaimed: 0,
    queueTotal: 0, queueUnclaimed: 0,
    imported: 0, duplicatesFound: 0, skippedNoTripId: 0,
    queueCleared: 0,
  };

  const { ids, liveDocs, liveUnclaimed } = await collectLiveTripIds();
  stats.liveDocs = liveDocs;
  stats.liveUnclaimed = liveUnclaimed;

  const qSnap = await db.collection("rideQueue").get();
  stats.queueTotal = qSnap.size;

  const toCreate = [];
  for (const doc of qSnap.docs) {
    const data = normalizeRide(doc.data());
    if (!isUnclaimed(data)) continue;
    stats.queueUnclaimed += 1;

    if (!data.tripId) { stats.skippedNoTripId += 1; continue; }
    const key = data.tripId;
    if (ids.has(key)) { stats.duplicatesFound += 1; continue; }

    const payload = {
      ...doc.data(),                       // copy ALL fields
      tripId: data.tripId,                 // normalized
      pickupTime: data.pickupTime || FieldValue.serverTimestamp(),
      ...(doc.data().status == null ? { status: "open" } : {}),
      importedFromQueueAt: FieldValue.serverTimestamp(),
      lastModifiedBy: "system@dropDailyRides",
    };

    toCreate.push({ key, payload });
    ids.add(key); // prevent dupes within the same run
  }

  if (!dryRun && toCreate.length) {
    const writer = db.bulkWriter();
    for (const { key, payload } of toCreate) {
      writer.create(db.collection("liveRides").doc(key), payload); // fail if exists (no dupes)
      stats.imported += 1;
    }
    await writer.close();
  } else {
    stats.imported = toCreate.length;
  }

  if (!dryRun && qSnap.size) {
    const delWriter = db.bulkWriter();
    for (const doc of qSnap.docs) { delWriter.delete(doc.ref); stats.queueCleared += 1; }
    await delWriter.close();
  } else {
    stats.queueCleared = qSnap.size;
  }

  if (!dryRun) {
    await db.doc("AdminMeta/lastDropDaily").set(
      { ranAt: FieldValue.serverTimestamp(), stats, v: 1 },
      { merge: true }
    );
  }

  return stats;
}

module.exports = { dropDailyFromQueue };

