/* Proprietary and confidential. See LICENSE. */
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

async function requireAdmin(req) {
  // Allow privileged access via pre-shared key for service automation
  const key = req.get("x-admin-key");
  if (key && process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY) {
    return { role: "admin" };
  }

  const authz = req.get("Authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) throw Object.assign(new Error("unauthorized"), { code: 401 });

  const idToken = m[1];
  const decoded = await admin.auth().verifyIdToken(idToken);

  // 1) Prefer custom claims
  const claimRole = (decoded.role || decoded.customClaims?.role || "").toLowerCase();
  if (claimRole === "admin") return decoded;

  // 2) Fallback to Firestore doc: userAccess/<lower(email)>.access === "admin"
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw Object.assign(new Error("unauthorized"), { code: 401 });

  const doc = await admin.firestore().doc(`userAccess/${email}`).get();
  const access = doc.exists ? String(doc.data().access || "").toLowerCase() : "";
  if (access !== "admin") throw Object.assign(new Error("forbidden"), { code: 403 });

  return decoded;
}

async function dropDailyRidesCore() {
  const db = admin.firestore();
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

const allowedOrigins = [
  "https://lakeridepros.xyz",
  "http://localhost:5173",
  "http://localhost:3000",
];

export const dropDailyRidesNow = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "256MiB",
    concurrency: 10,
    maxInstances: 5,
    cors: allowedOrigins,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method not allowed" });
    }
    try {
      await requireAdmin(req);
      logger.info("[dropDailyRidesNow] start");
      const result = await dropDailyRidesCore();
      logger.info("[dropDailyRidesNow] done", result);
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      logger.warn("dropDailyRidesNow error", err);
      const code = err.code || 500;
      return res.status(code).json({ ok: false, error: err.message || "Internal error" });
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
