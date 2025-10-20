const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_NUMBER = defineSecret("TWILIO_NUMBER");

try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (error) {
  logger.warn("sendPartnerInfoSMS.init", error?.message || error);
}

const db = admin.firestore();

function normalizePhone(to) {
  if (!to || typeof to !== "string") return null;
  const digits = to.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

function buildMessage(item) {
  if (item?.smsTemplate) return item.smsTemplate;
  const lines = [
    item?.title ? `${item.title}` : "Important Info",
    item?.blurb ? `${item.blurb}` : null,
    item?.details ? `${item.details}` : null,
    item?.phone ? `Phone: ${item.phone}` : null,
    item?.url ? `More: ${item.url}` : null,
    "— Sent via Lake Ride Pros",
  ].filter(Boolean);
  const message = lines.join("\n").trim();
  return message.length > 840 ? `${message.slice(0, 837)}…` : message;
}

exports.sendPartnerInfoSMS = onCall(
  {
    region: "us-central1",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER],
    cors: true,
    enforceAppCheck: false,
  },
  async (request) => {
    const { data, auth } = request;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to send messages.");
    }

    const itemId = data?.itemId;
    const rawTo = data?.to;
    if (!itemId) {
      throw new HttpsError("invalid-argument", "Missing itemId.");
    }

    const to = normalizePhone(rawTo);
    if (!to) {
      throw new HttpsError("invalid-argument", "Invalid destination phone.");
    }

    const docRef = db.collection("importantInfo").doc(itemId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Important info item not found.");
    }
    const item = snap.data();
    if (item?.isActive === false) {
      throw new HttpsError("failed-precondition", "Item is inactive.");
    }

    const from = TWILIO_NUMBER.value();
    if (!from) {
      throw new HttpsError("failed-precondition", "Missing Twilio number secret.");
    }

    const body = buildMessage(item);

    const client = require("twilio")(
      TWILIO_ACCOUNT_SID.value(),
      TWILIO_AUTH_TOKEN.value(),
    );

    let result;
    try {
      result = await client.messages.create({
        to,
        from,
        body,
      });
    } catch (error) {
      logger.error("sendPartnerInfoSMS.twilio_error", {
        message: error?.message || error,
        code: error?.code,
      });
      throw new HttpsError("internal", "Failed to send SMS.");
    }

    const logEntry = {
      type: "partnerInfo",
      itemId,
      to,
      sid: result.sid,
      status: result.status || "queued",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: auth?.uid || "unknown",
    };

    try {
      await db.collection("smsLogs").add(logEntry);
    } catch (logError) {
      logger.warn("sendPartnerInfoSMS.log_write_failed", {
        message: logError?.message || logError,
        itemId,
        to,
      });
    }

    return { ok: true, sid: result.sid, status: result.status };
  },
);
