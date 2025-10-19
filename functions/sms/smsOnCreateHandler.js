const { FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const TWILIO_SECRETS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
];

/**
 * Idempotency guard: ensures an eventId is processed only once.
 * Returns true if this caller should process; false if already processed elsewhere.
 * @param {string|undefined|null} eventId
 */
async function ensureOnce(eventId) {
  if (!eventId) return true;
  const db = admin.firestore();
  const docRef = db.doc(`__functionEvents/smsOnCreate/${eventId}`);
  try {
    await docRef.create({
      createdAt: FieldValue.serverTimestamp(),
      eventId,
      func: "smsOnCreate",
    });
    return true;
  } catch {
    logger.warn("smsOnCreate idempotency: duplicate event, skipping", { eventId });
    return false;
  }
}

/**
 * Core business logic for SMS documents created in "outboundMessages/{id}".
 * @param {object} payload
 * @param {object} meta
 * @returns {Promise<null|void>}
 */
async function handleSmsOnCreate(payload, meta = {}, options = {}) {
  if (!payload || payload.channel !== "sms") {
    return null;
  }

  const allowed = await ensureOnce(meta?.eventId);
  if (!allowed) return null;

  const db = admin.firestore();
  const docPath = meta?.docPath;
  const docRef = docPath ? db.doc(docPath) : null;

  const env = process.env || {};
  const config = {
    accountSid: options.accountSid || env.TWILIO_ACCOUNT_SID || "",
    authToken: options.authToken || env.TWILIO_AUTH_TOKEN || "",
    from: options.twilioFrom || env.TWILIO_FROM || "",
  };
  const missing = TWILIO_SECRETS.filter((key) => {
    if (key === "TWILIO_ACCOUNT_SID") return !config.accountSid;
    if (key === "TWILIO_AUTH_TOKEN") return !config.authToken;
    if (key === "TWILIO_FROM") return !config.from;
    return false;
  });

  const client = options.twilioClient || null;

  const updateDoc = async (fields) => {
    if (!docRef) {
      logger.error("smsOnCreate handler missing docRef", {
        docPath,
        fields,
      });
      return;
    }
    try {
      await docRef.update(fields);
    } catch (err) {
      logger.error("smsOnCreate handler failed to update document", {
        docPath,
        err: err && (err.stack || err.message || err),
      });
    }
  };

  const fail = async (error) => {
    await updateDoc({
      status: "error",
      error:
        typeof error === "string"
          ? error
          : error?.response?.data
            ? JSON.stringify(error.response.data)
            : String(error?.message || error),
      lastTriedAt: FieldValue.serverTimestamp(),
    });
    return null;
  };

  if (missing.length) {
    return fail(`Missing Twilio env vars: ${missing.join(", ")}`);
  }

  if (!client) {
    return fail("Missing Twilio client");
  }

  const { to, body } = payload;
  if (!to || !body) {
    return fail("Missing to/body");
  }

  try {
    const message = {
      to,
      body,
    };
    if (String(config.from).startsWith("MG")) {
      message.messagingServiceSid = config.from;
    } else {
      message.from = config.from;
    }

    const data = await client.messages.create(message);

    await updateDoc({
      status: "sent",
      provider: "twilio",
      providerMessageId: data.sid,
      sentAt: FieldValue.serverTimestamp(),
    });
    return null;
  } catch (err) {
    logger.error("smsOnCreate handler failed", {
      err: err && (err.stack || err.message || err),
      meta,
    });
    return fail(err);
  }
}

module.exports = { handleSmsOnCreate, ensureOnce };
