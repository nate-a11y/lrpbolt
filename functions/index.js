/* Proprietary and confidential. See LICENSE. */
const functionsV1 = require("firebase-functions/v1");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const twilio = require("twilio");

const { admin } = require("./_admin");
const { handleSmsOnCreate } = require("./sms/smsOnCreateHandler");
const { apiCalendarFetch } = require("./calendarFetch");
const { dropDailyFromQueue } = require("./src/jobs/dropDailyFromQueue");
const { ensureLiveRideOpen } = require("./ensureLiveOpen");
const notifyQueueModule = require("./notifyQueue");
const ticketsOnWriteModule = require("./ticketsOnWrite");
const ticketsV2Module = require("./ticketsV2");
const { migrateIssueTickets } = require("./adminMigrateIssueTickets");

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = defineSecret("TWILIO_FROM");

const FUNCTIONS_REGION = process.env.FUNCTIONS_REGION || "us-central1";

try {
  setGlobalOptions({
    region: FUNCTIONS_REGION,
    memory: "256MiB",
    timeoutSeconds: 60,
    concurrency: 80,
    cpu: 1,
  });
} catch (error) {
  if (process.env.NODE_ENV !== "production") {
    logger.warn("setGlobalOptions unavailable", error?.message || error);
  }
}

const db = admin.firestore();
const messagingClient = admin.messaging();

function toDateMaybe(ts) {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (typeof ts._seconds === "number") return new Date(ts._seconds * 1000);
    return new Date(ts);
  } catch (error) {
    logger.warn("toDateMaybe error", error?.message || error);
    return null;
  }
}

function fmtMdyTime(dateLike) {
  const d = toDateMaybe(dateLike);
  if (!d) return "";
  const s = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: process.env.SMS_TZ || "America/Chicago",
  }).format(d);
  return String(s).replace(",", "");
}

function fmtDurationHHMM(data) {
  const s = toDateMaybe(data?.pickupTime || data?.startTime);
  const e = toDateMaybe(data?.endTime);
  let minutes = null;

  if (s && e) {
    minutes = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
  } else if (typeof data?.rideDuration === "number") {
    minutes =
      data.rideDuration <= 24
        ? Math.round(data.rideDuration * 60)
        : Math.round(data.rideDuration);
    if (minutes < 0) minutes = 0;
  }

  if (minutes == null) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

async function hasLiveRides() {
  const snap = await db.collection("liveRides").limit(1).get();
  return !snap.empty;
}

async function ensureNotAlreadySentForToday() {
  const today = new Date().toISOString().slice(0, 10);
  const logRef = db
    .collection("notifications")
    .doc("dailyDrop")
    .collection("days")
    .doc(today);
  const snapshot = await logRef.get();
  if (snapshot.exists) return { already: true };
  await logRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { already: false, logRef };
}

function buildDailyDropMessage() {
  const title = "Lake Ride Pros";
  const body = "New Rides Have Dropped in the Portal";
  const imageUrl = "https://lakeridepros.xyz/android-chrome-192x192.png";
  const clickLink = "https://lakeridepros.xyz/tickets?tab=live";
  const topic = "allUsers";

  return {
    topic,
    notification: { title, body, imageUrl },
    data: { kind: "daily-drop", deeplink: clickLink },
    android: { priority: "high", notification: { imageUrl } },
    apns: {
      payload: { aps: { sound: "default" } },
      fcm_options: { image: imageUrl },
    },
    webpush: {
      fcmOptions: { link: clickLink },
      notification: { image: imageUrl },
    },
  };
}

async function hasAccess(email) {
  const snap = await db.doc(`userAccess/${email}`).get();
  return snap.exists ? String(snap.data().access || "").toLowerCase() : "";
}

async function requireAdmin(emailLower) {
  const access = await hasAccess(emailLower);
  if (access !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }
}

exports.smsOnCreate = functionsV1
  .region(FUNCTIONS_REGION)
  .firestore.document("outboundMessages/{id}")
  .onCreate(async (snap, context) => {
    try {
      const data = snap?.data() || null;
      const docPath = snap?.ref?.path || `outboundMessages/${context?.params?.id}`;
      const meta = {
        docId: context?.params?.id,
        docPath,
        eventId: context?.eventId,
        createTime: snap?.createTime,
      };
      const env = process.env || {};
      const sid = env.TWILIO_ACCOUNT_SID || "";
      const token = env.TWILIO_AUTH_TOKEN || "";
      const from = env.TWILIO_FROM || "";
      const client = sid && token ? twilio(sid, token) : null;
      await handleSmsOnCreate(data, meta, {
        twilioClient: client,
        accountSid: sid,
        authToken: token,
        twilioFrom: from,
      });
      return null;
    } catch (error) {
      logger.error("smsOnCreate (v1) failed", {
        err: error && (error.stack || error.message || error),
      });
      throw error;
    }
  });

exports.smsOnCreateV2 = onDocumentCreated(
  {
    document: "outboundMessages/{id}",
    region: FUNCTIONS_REGION,
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data?.to || !data?.body) {
      throw new Error("Missing to/body");
    }

    const sid = TWILIO_ACCOUNT_SID.value();
    const token = TWILIO_AUTH_TOKEN.value();
    const from = TWILIO_FROM.value();
    const client = twilio(sid, token);

    const docPath = event?.data?.ref?.path || `outboundMessages/${event?.params?.id}`;
    const meta = {
      docId: event?.params?.id,
      docPath,
      eventId: event?.id,
      createTime: event?.time,
    };

    try {
      await handleSmsOnCreate(data, meta, {
        twilioClient: client,
        accountSid: sid,
        authToken: token,
        twilioFrom: from,
      });
      return null;
    } catch (error) {
      logger.error("smsOnCreateV2 (v2) failed", {
        err: error && (error.stack || error.message || error),
      });
      throw error;
    }
  },
);

exports.ensureLiveRideOpen = ensureLiveRideOpen;

exports.sendPortalNotification = onCall(async (req) => {
  const authEmail = req.auth?.token?.email || "unknown";
  const { title, body, icon, data, email, token, topic } = req.data || {};
  if (!title) throw new HttpsError("invalid-argument", "title required");

  const access = await hasAccess(authEmail);
  if (access !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const base = {
    notification: { title, body },
    webpush: {
      notification: { icon: icon || "/icons/icon-192x192.png" },
      data: data || {},
    },
  };

  try {
    if (token) {
      await messagingClient.send({ ...base, token });
      return { ok: true, count: 1 };
    }
    if (email) {
      const qs = await db.collection("fcmTokens").where("email", "==", email).get();
      const tokens = qs.docs.map((d) => d.data().token).filter(Boolean);
      if (!tokens.length) return { ok: true, count: 0 };
      const results = await Promise.allSettled(tokens.map((t) => messagingClient.send({ ...base, token: t })));
      let count = 0;
      for (let i = 0; i < results.length; i += 1) {
        const res = results[i];
        if (res.status === "fulfilled") {
          count += 1;
          continue;
        }
        const err = res.reason;
        if (
          err?.code === "messaging/registration-token-not-registered" ||
          err?.message?.includes("Requested entity was not found")
        ) {
          const t = tokens[i];
          const docId = `${email}__${t.slice(0, 16)}`;
          await db.collection("fcmTokens").doc(docId).delete().catch(() => undefined);
          continue;
        }
        throw err;
      }
      return { ok: true, count };
    }
    if (topic) {
      await messagingClient.send({ ...base, topic });
      return { ok: true, count: 1 };
    }
    throw new HttpsError("invalid-argument", "Provide token, email, or topic.");
  } catch (error) {
    logger.error("sendPortalNotification error", error);
    throw new HttpsError("internal", error.message || "send error");
  }
});

exports.apiCalendarFetch = apiCalendarFetch;

exports.dropDailyRidesNow = onCall({ region: FUNCTIONS_REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const email = String(req.auth.token.email || "").toLowerCase();
  await requireAdmin(email);

  try {
    const dryRun = !!(req.data && req.data.dryRun);
    const stats = await dropDailyFromQueue({ dryRun });
    return { ok: true, dryRun, stats };
  } catch (error) {
    logger.error("dropDailyRidesNow failed", { err: error });
    throw new HttpsError("internal", error?.message || "Internal error");
  }
});

exports.dailyDropIfLiveRides = onSchedule(
  {
    region: FUNCTIONS_REGION,
    schedule: "0 20 * * *",
    timeZone: "America/Chicago",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    try {
      const { already } = await ensureNotAlreadySentForToday();
      if (already) {
        logger.info("Already sent daily drop today, skipping.");
        return;
      }

      const exists = await hasLiveRides();
      if (!exists) {
        logger.info("No live rides found, skipping push.");
        return;
      }

      const message = buildDailyDropMessage();
      const id = await messagingClient.send(message);
      logger.info("Daily Drop sent successfully", id);
    } catch (error) {
      logger.error("dailyDropIfLiveRides failed", { err: error });
      throw error;
    }
  },
);

exports.sendDailySms = onSchedule(
  {
    region: FUNCTIONS_REGION,
    schedule: "0 14 * * *",
    timeZone: "America/Chicago",
  },
  async () => {
    try {
      await db.collection("outboundMessages").add({
        to: "+15733532849",
        body:
          "Hey Jim 👋 don’t forget to check the rides in Moovs, charge the deposits 💳, and add everything into the portal 📲✅.",
        channel: "sms",
        status: "queued",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("sendDailySms queued");
    } catch (error) {
      logger.error("sendDailySms error", { err: error });
    }
  },
);

exports.scheduleDropDailyRides = onSchedule(
  {
    region: FUNCTIONS_REGION,
    schedule: "30 19 * * *",
    timeZone: "America/Chicago",
  },
  async () => {
    try {
      const cfg = await db.doc("AdminMeta/config").get();
      const dropEnabled = cfg.exists ? cfg.data().dropEnabled !== false : true;
      if (!dropEnabled) {
        logger.info("dropDailyRides skipped by config");
        return;
      }

      const stats = await dropDailyFromQueue({ dryRun: false });
      await db
        .doc("AdminMeta/lastDropDaily")
        .set(
          {
            ranAt: admin.firestore.FieldValue.serverTimestamp(),
            stats,
            v: 1,
            trigger: "schedule",
          },
          { merge: true },
        );
      logger.info("dropDailyRides complete", stats);
    } catch (error) {
      logger.error("scheduleDropDailyRides error", { err: error });
    }
  },
);

function normalizeEmail(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "object") {
    const candidate =
      value.email ||
      value.primaryEmail ||
      value.loginEmail ||
      value.userEmail ||
      value.contactEmail ||
      value.uid ||
      value.id ||
      "";
    return normalizeEmail(candidate);
  }
  return String(value).trim().toLowerCase();
}

async function ensureOutboxOnce(key, info) {
  const ref = db.collection("notificationsOutbox").doc(key);
  try {
    await ref.create({
      ...info,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    if (
      error?.code === 6 ||
      error?.code === "already-exists" ||
      error?.message?.toLowerCase().includes("already exists")
    ) {
      return false;
    }
    throw error;
  }
}

async function sendClaimSms(to, body) {
  const sid = TWILIO_ACCOUNT_SID.value();
  const token = TWILIO_AUTH_TOKEN.value();
  const from = TWILIO_FROM.value();
  if (!sid || !token || !from) {
    throw new Error("Twilio configuration missing");
  }
  const client = twilio(sid, token);
  await client.messages.create({ to, from, body });
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

async function notifyDriverOfClaim(rideId, data) {
  if (!rideId || !data) return;
  const driverEmail = normalizeEmail(data.claimedBy || data.ClaimedBy);
  if (!driverEmail || !driverEmail.includes("@")) {
    logger.info("notifyDriverOfClaim skipped: missing driver email", {
      rideId,
      claimedBy: data.claimedBy,
    });
    return;
  }

  const accessSnap = await db.doc(`userAccess/${driverEmail}`).get();
  if (!accessSnap.exists) {
    logger.info("notifyDriverOfClaim skipped: userAccess missing", {
      rideId,
      driverEmail,
    });
    return;
  }
  const phone = accessSnap.get("phone");
  if (!phone) {
    logger.info("notifyDriverOfClaim skipped: phone missing", {
      rideId,
      driverEmail,
    });
    return;
  }

  const vehicle = firstDefined(data.vehicle, data.Vehicle) || "ride";
  const tripId = firstDefined(data.tripId, data.TripID, data.id, rideId);

  const outboxKey = `driverClaimSms_${rideId}_${driverEmail.replace(/[^a-z0-9]/gi, "_")}`;
  const recorded = await ensureOutboxOnce(outboxKey, {
    to: phone,
    driverEmail,
    tripId: String(tripId || ""),
    vehicle,
    type: "driver-claim-sms",
  });
  if (!recorded) {
    logger.info("notifyDriverOfClaim skipped: already sent", {
      rideId,
      driverEmail,
    });
    return;
  }

  const tripIdForSms = data?.tripId || rideId;
  const vehicleLabel = (() => {
    const code = data?.vehicleCode || data?.vehicleId || data?.vehicleTag;
    const name = data?.vehicleName || data?.vehicle || data?.unit;
    if (code && name) return `${code} - ${name}`;
    return code || name || "Vehicle";
  })();

  const dateTime = fmtMdyTime(data?.pickupTime || data?.startTime) || "TBD";
  const duration = fmtDurationHHMM(data);
  const tripType = data?.rideType || "N/A";
  const notes = (data?.rideNotes || data?.notes || "").toString().trim() || "none";
  const claimedAt = fmtMdyTime(data?.claimedAt) || fmtMdyTime(new Date());

  const body =
    `Trip ID: ${tripIdForSms}\n` +
    `Vehicle: ${vehicleLabel}\n` +
    `Date/Time: ${dateTime}\n` +
    `Duration: ${duration}\n` +
    `Trip Type: ${tripType}\n` +
    `Trip Notes: ${notes}\n\n` +
    `Claimed At: ${claimedAt}`;
  await sendClaimSms(phone, body);
}

exports.notifyDriverOnClaimCreated = onDocumentCreated(
  {
    document: "claimedRides/{rideId}",
    region: FUNCTIONS_REGION,
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM],
  },
  async (event) => {
    try {
      const data = event.data?.data();
      if (!data) return;
      await notifyDriverOfClaim(event.params.rideId, data);
    } catch (error) {
      logger.error("notifyDriverOnClaimCreated failed", {
        err: error && (error.stack || error.message || error),
        rideId: event.params?.rideId,
      });
      throw error;
    }
  },
);

exports.notifyDriverOnClaimUpdated = onDocumentUpdated(
  {
    document: "liveRides/{rideId}",
    region: FUNCTIONS_REGION,
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM],
  },
  async (event) => {
    try {
      const before = event.data?.before?.data() || {};
      const after = event.data?.after?.data() || {};
      const wasClaimed = Boolean(before.claimedAt || before.ClaimedAt);
      const isClaimed = Boolean(after.claimedAt || after.ClaimedAt);
      if (!wasClaimed && isClaimed) {
        await notifyDriverOfClaim(event.params.rideId, after);
      }
    } catch (error) {
      logger.error("notifyDriverOnClaimUpdated failed", {
        err: error && (error.stack || error.message || error),
        rideId: event.params?.rideId,
      });
      throw error;
    }
  },
);

exports.notifyQueue = notifyQueueModule;
exports.notifyQueueOnCreate = notifyQueueModule.notifyQueueOnCreate;
exports.ticketsOnWrite = ticketsOnWriteModule.ticketsOnWrite;
exports.slaSweep = ticketsOnWriteModule.slaSweep;
exports.ticketsOnWriteV2 = ticketsV2Module.ticketsOnWrite;
exports.slaSweepV2 = ticketsV2Module.slaSweep;
exports.migrateIssueTickets = migrateIssueTickets;
exports.adminMigrate = { migrateIssueTickets };

process.on("unhandledRejection", (err) => {
  logger.error("🔥 Unhandled rejection:", err);
});
