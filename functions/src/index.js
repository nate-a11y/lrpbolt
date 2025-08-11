import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import cors from "cors";
import { db } from "./admin.js";

const REGION = "us-central1";
const QUEUE_COL = "rideQueue";
const LIVE_COL = "liveRides";
const TZ = "America/Chicago";
const DAILY_CRON = "0 18 * * *";

export async function moveQueuedToLive({ dryRun = false, limit = 1500 } = {}) {
  const start = Date.now();
  let processed = 0;
  let skipped = 0;
  logger.info("[moveQueuedToLive] start", { dryRun, limit });

  const queuedSnap = await db
    .collection(QUEUE_COL)
    .where("status", "==", "queued")
    .orderBy("createdAt", "asc")
    .limit(limit)
    .get();

  let docs = queuedSnap.docs;
  if (docs.length < limit) {
    const remaining = limit - docs.length;
    const nullSnap = await db
      .collection(QUEUE_COL)
      .where("status", "==", null)
      .orderBy("createdAt", "asc")
      .limit(remaining)
      .get();
    docs = docs.concat(nullSnap.docs);
  }

  const writer = db.bulkWriter();
  writer.onWriteError((err) => {
    logger.error("[moveQueuedToLive] BulkWriter error", {
      path: err.documentRef.path,
      attempts: err.failedAttempts,
      error: err.message,
    });
    if (err.failedAttempts < 3) {
      return true; // retry
    }
    skipped += 1;
    return false;
  });

  for (const doc of docs) {
    const data = doc.data();
    if (!data || (data.status && data.status !== "queued" && data.status !== null)) {
      continue;
    }
    if (!data.pickupTime && !data.startTime) {
      skipped += 1;
      continue;
    }
    processed += 1;
    if (!dryRun) {
      const dstRef = db.collection(LIVE_COL).doc(doc.id);
      writer.set(
        dstRef,
        {
          ...data,
          status: "live",
          movedAt: Timestamp.now(),
          _movedFrom: QUEUE_COL,
          _movedByFn: "moveQueuedToLive",
          _updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      writer.delete(doc.ref);
    }
  }

  if (!dryRun) {
    await writer.close();
  } else {
    writer.close();
  }

  const durationMs = Date.now() - start;
  const moved = processed - skipped;
  logger.info("[moveQueuedToLive] complete", { moved, skipped, durationMs, dryRun });
  return { moved, skipped, durationMs, dryRun };
}

const corsHandler = cors({ origin: true });

export const dropDailyRidesNow = functions
  .region(REGION)
  .runWith({ maxInstances: 1, timeoutSeconds: 540, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Method Not Allowed" });
        return;
      }

      const expected = process.env.LRP_ADMIN_TOKEN;
      const provided = req.get("x-lrp-admin-token");
      if (expected && provided !== expected) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }

      try {
        const { dryRun = false, limit = 1500 } = req.body || {};
        const result = await moveQueuedToLive({ dryRun, limit });
        res.status(200).json({ ok: true, ...result });
      } catch (err) {
        logger.error("[dropDailyRidesNow]", err);
        res.status(500).json({ ok: false, error: err.message || String(err) });
      }
    });
  });

export const moveQueuedToLiveDaily = functions
  .region(REGION)
  .pubsub.schedule(DAILY_CRON)
  .timeZone(TZ)
  .retryConfig({
    retryCount: 3,
    maxRetryDurationSeconds: 600,
    minBackoffSeconds: 10,
    maxBackoffSeconds: 60,
    maxDoublings: 4,
  })
  .onRun(async () => {
    await moveQueuedToLive();
  });
