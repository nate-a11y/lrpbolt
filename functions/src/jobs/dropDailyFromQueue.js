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

async function collectLiveTripIndex() {
  const snap = await db.collection("liveRides").get();
  const index = new Map();
  let liveUnclaimed = 0;

  for (const doc of snap.docs) {
    const data = normalizeRide(doc.data());
    const entry = { ref: doc.ref, data };

    const docIdKey = String(doc.id || "").trim();
    if (docIdKey) index.set(docIdKey, entry);

    if (data.tripId) {
      const tripKey = String(data.tripId || "").trim();
      if (tripKey) index.set(tripKey, entry);
    }

    if (isUnclaimed(data)) liveUnclaimed += 1;
  }

  return { index, liveDocs: snap.size, liveUnclaimed };
}

/**
 * Behavior:
 * - Read all Live; duplicates are not allowed (claimed or unclaimed).
 * - From rideQueue, take ONLY unclaimed; require TripID.
 * - If TripID exists in liveRides and is unclaimed, overwrite it.
 * - Copy ALL fields to liveRides with docId = TripID (create when new).
 * - Clear ALL docs in rideQueue.
 * - Write AdminMeta/lastDropDaily with stats.
 */
async function dropDailyFromQueue({ dryRun = false } = {}) {
  const stats = {
    liveDocs: 0,
    liveUnclaimed: 0,
    queueTotal: 0,
    queueUnclaimed: 0,
    imported: 0,
    duplicatesFound: 0,
    skippedNoTripId: 0,
    queueCleared: 0,
    updatedExisting: 0,
    skippedClaimedLive: 0,
  };

  const { index, liveDocs, liveUnclaimed } = await collectLiveTripIndex();
  stats.liveDocs = liveDocs;
  stats.liveUnclaimed = liveUnclaimed;

  const qSnap = await db.collection("rideQueue").get();
  stats.queueTotal = qSnap.size;

  const toCreate = [];
  const toUpdate = [];
  const seen = new Set();
  for (const doc of qSnap.docs) {
    const data = normalizeRide(doc.data());
    if (!isUnclaimed(data)) continue;
    stats.queueUnclaimed += 1;

    if (!data.tripId) { stats.skippedNoTripId += 1; continue; }
    const key = String(data.tripId || "").trim();
    if (!key) { stats.skippedNoTripId += 1; continue; }

    if (seen.has(key)) {
      stats.duplicatesFound += 1;
      continue;
    }

    const payload = {
      ...doc.data(),                       // copy ALL fields
      tripId: key,                         // normalized
      pickupTime: data.pickupTime || FieldValue.serverTimestamp(),
      ...(doc.data().status == null ? { status: "open" } : {}),
      importedFromQueueAt: FieldValue.serverTimestamp(),
      lastModifiedBy: "system@dropDailyRides",
    };

    const existing = index.get(key);
    if (existing) {
      stats.duplicatesFound += 1;
      if (isUnclaimed(existing.data)) {
        toUpdate.push({ ref: existing.ref, payload });
      } else {
        stats.skippedClaimedLive += 1;
      }
      seen.add(key);
      continue;
    }

    toCreate.push({ key, payload });
    seen.add(key);
  }

  if (!dryRun) {
    if (toCreate.length || toUpdate.length) {
      const writer = db.bulkWriter();
      for (const { key, payload } of toCreate) {
        writer.create(db.collection("liveRides").doc(key), payload);
      }
      for (const { ref, payload } of toUpdate) {
        writer.set(ref, payload, { merge: false });
      }
      await writer.close();
    }
    stats.imported = toCreate.length;
    stats.updatedExisting = toUpdate.length;
  } else {
    stats.imported = toCreate.length;
    stats.updatedExisting = toUpdate.length;
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

