import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { corsMiddleware } from "../cors.js";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const REGION = "us-central1";
const QUEUE_COL = "rideQueue";
const LIVE_COL = "liveRides";

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

export const dropDailyRidesNowV2 = onRequest(
  {
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 540,
    concurrency: 1,
    maxInstances: 1,
    minInstances: 0,
  },
  async (req, res) => {
    corsMiddleware(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }
        if (req.method !== "POST") {
          return res.status(405).json({ ok: false, error: "Method Not Allowed" });
        }

        const expected = process.env.LRP_ADMIN_TOKEN || "dev-override-token"; // TODO: move to Secret Manager
        const provided = req.get("x-lrp-admin-token");
        if (expected && provided !== expected) {
          logger.warn("Unauthorized dropDailyRidesNow attempt");
          return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        const { dryRun = false, limit = 1500 } = req.body || {};
        const result = await moveQueuedToLive({ dryRun, limit });
        return res.status(200).json({ ok: true, ...result });
      } catch (err) {
        logger.error("dropDailyRidesNow failed", err);
        return res.status(500).json({ ok: false, error: err.message || String(err) });
      }
    });
  }
);

export const dropDailyRidesDailyV2 = onSchedule(
  {
    region: REGION,
    schedule: "30 3 * * *",
    timeZone: "America/Chicago",
    memory: "512MiB",
    timeoutSeconds: 540,
    concurrency: 1,
    maxInstances: 1,
    minInstances: 0,
    retryCount: 0,
  },
  async (event) => {
    try {
      logger.info("[dropDailyRidesDaily] start", { eventId: event.id });
      const result = await moveQueuedToLive();
      logger.info("[dropDailyRidesDaily] complete", result);
    } catch (err) {
      logger.error("dropDailyRidesDaily failed", err);
      throw err;
    }
  }
);
