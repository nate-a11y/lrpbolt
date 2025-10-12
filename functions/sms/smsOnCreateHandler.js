const { FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const axios = require("axios");

const TWILIO_SECRETS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
];

/**
 * Idempotency guard: ensures a document-trigger pair is processed only once.
 * Returns true if this caller should process; false if already processed elsewhere.
 * @param {string|undefined|null} docPath
 * @param {string|undefined|null} eventId
 */
async function ensureOnce(docPath, eventId) {
  const dedupeKey = docPath || eventId;
  if (!dedupeKey) return true;

  const docId = dedupeKey.replace(/\//g, "__");
  const db = admin.firestore();
  const docRef = db.doc(`__functionEvents/smsOnCreate/${docId}`);
  try {
    await docRef.create({
      createdAt: FieldValue.serverTimestamp(),
      eventId,
      docPath,
      func: "smsOnCreate",
    });
    return true;
  } catch (err) {
    logger.warn("smsOnCreate idempotency: duplicate event, skipping", {
      docPath,
      eventId,
    });
    return false;
  }
}

/**
 * Core business logic for SMS documents created in "outboundMessages/{id}".
 * @param {object} payload
 * @param {object} meta
 * @returns {Promise<null|void>}
 */
async function handleSmsOnCreate(payload, meta = {}) {
  if (!payload || payload.channel !== "sms") {
    return null;
  }

  const allowed = await ensureOnce(meta?.docPath, meta?.eventId);
  if (!allowed) return null;

  const db = admin.firestore();
  const docPath = meta?.docPath;
  const docRef = docPath ? db.doc(docPath) : null;

  const env = process.env || {};
  const missing = TWILIO_SECRETS.filter((key) => !env[key]);

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

  const { to, body } = payload;
  if (!to || !body) {
    return fail("Missing to/body");
  }

  try {
    const client = axios.create({
      baseURL: `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}`,
      auth: { username: env.TWILIO_ACCOUNT_SID, password: env.TWILIO_AUTH_TOKEN },
      timeout: 12000,
    });

    const form = new URLSearchParams({ To: to, Body: body });
    if (String(env.TWILIO_FROM).startsWith("MG")) {
      form.set("MessagingServiceSid", env.TWILIO_FROM);
    } else {
      form.set("From", env.TWILIO_FROM);
    }

    const { data } = await client.post("/Messages.json", form);

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

module.exports = { handleSmsOnCreate, ensureOnce, TWILIO_SECRETS };
