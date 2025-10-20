const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

try {
  admin.initializeApp();
} catch (e) {
  // no-op; already initialized in tests or emulator
}

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = defineSecret("TWILIO_FROM");

function normalizePhone(to) {
  if (!to || typeof to !== "string") return null;
  const digits = to.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

const SMS_FOOTER =
  "— Sent from a Lake Ride Pros automated number. Replies are not monitored.";

function buildMessage(item) {
  const appendFooter = (base) => {
    const trimmed = typeof base === "string" ? base.trim() : "";
    return `${trimmed}\n${SMS_FOOTER}`;
  };
  if (item?.smsTemplate) return appendFooter(item.smsTemplate);
  const lines = [
    item?.title ? `${item.title}` : "Important Info",
    item?.blurb ? `${item.blurb}` : null,
    item?.details ? `${item.details}` : null,
    item?.phone ? `Phone: ${item.phone}` : null,
    item?.url ? `More: ${item.url}` : null,
    SMS_FOOTER,
  ].filter(Boolean);
  const message = lines.join("\n").trim();
  return message.length > 840 ? `${message.slice(0, 837)}…` : message;
}

exports.sendPartnerInfoSMS = onCall(
  {
    region: "us-central1",
    secrets: [
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_FROM,
    ],
    cors: true,
    enforceAppCheck: false,
  },
  async (request) => {
    const { data, auth } = request;
    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be signed in to send messages.",
      );
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

    const snap = await admin
      .firestore()
      .collection("importantInfo")
      .doc(itemId)
      .get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Important info item not found.");
    }
    const item = snap.data();
    if (item?.isActive === false) {
      throw new HttpsError("failed-precondition", "Item is inactive.");
    }

    const from = (TWILIO_FROM.value && TWILIO_FROM.value())?.trim();
    if (!from) {
      throw new HttpsError(
        "failed-precondition",
        "Missing TWILIO_FROM in Secret Manager.",
      );
    }

    const client = require("twilio")(
      TWILIO_ACCOUNT_SID.value(),
      TWILIO_AUTH_TOKEN.value(),
    );
    const body = buildMessage(item);

    try {
      const resp = await client.messages.create({ to, from, body });
      await admin
        .firestore()
        .collection("smsLogs")
        .add({
          type: "partnerInfo",
          itemId,
          to,
          sid: resp.sid,
          status: resp.status || "queued",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          userId: auth?.uid || "unknown",
        });
      return { ok: true, sid: resp.sid, status: resp.status };
    } catch (err) {
      console.error("Twilio send error", err);
      throw new HttpsError("internal", "Failed to send SMS.");
    }
  },
);
