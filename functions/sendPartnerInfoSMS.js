const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

let twilio = null;
try {
  twilio = require("twilio");
} catch (error) {
  logger.warn("sendPartnerInfoSMS:twilio-missing", error?.message || error);
}

const { admin } = require("./admin");

const REGION = "us-central1";

const SMS_FOOTER =
  "— Sent from a Lake Ride Pros automated number. Replies are not monitored.";

function asE164(raw) {
  const input = typeof raw === "string" || typeof raw === "number" ? raw : "";
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/[^\d+]/g, "");
  if (!sanitized) return null;
  if (sanitized.startsWith("+")) {
    return /^\+\d{8,15}$/.test(sanitized) ? sanitized : null;
  }
  const digits = sanitized.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

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

function loadSecretValue(envKey, label) {
  try {
    const value = process.env[envKey];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) {
      logger.error("sendPartnerInfoSMS.secretEmpty", { label });
      return null;
    }
    return trimmed;
  } catch (error) {
    logger.error("sendPartnerInfoSMS.secretLoadFailed", { label, error });
    return null;
  }
}

function mapTwilioError(err) {
  const code = err?.code;
  const status = err?.status;
  const message = err?.message || "Twilio request failed.";
  if (code === 21211 || code === 21614) {
    return {
      statusCode: "invalid-argument",
      message: "Twilio rejected the phone number. Confirm it is a valid mobile number in E.164 format.",
      reason: "invalid-phone",
    };
  }
  if (code === 21610) {
    return {
      statusCode: "failed-precondition",
      message: "The destination number has unsubscribed from SMS messages.",
      reason: "unsubscribed",
    };
  }
  if (code === 21612 || code === 21408) {
    return {
      statusCode: "failed-precondition",
      message: "Twilio is not enabled to send to this region. Verify SMS permissions for the account.",
      reason: "unsupported-region",
    };
  }
  return {
    statusCode: "internal",
    message,
    reason: status || "twilio-error",
  };
}

async function logSmsAttempt(payload) {
  try {
    await admin
      .firestore()
      .collection("smsLogs")
      .add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...payload,
      });
  } catch (error) {
    logger.error("sendPartnerInfoSMS.logFailure", {
      error: error?.message || error,
      payload,
    });
  }
}

exports.sendPartnerInfoSMS = onCall(
  {
    region: REGION,
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
    if (!itemId) {
      throw new HttpsError("invalid-argument", "Missing itemId.");
    }

    const normalizedTo = asE164(data?.to);
    if (!normalizedTo) {
      throw new HttpsError(
        "invalid-argument",
        "Destination phone must be a valid E.164 number.",
      );
    }

    const dryRun = data?.dryRun === true;

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

    const from = loadSecretValue("TWILIO_FROM", "TWILIO_FROM");
    if (!from) {
      throw new HttpsError(
        "failed-precondition",
        "Missing TWILIO_FROM secret configuration.",
      );
    }
    if (!/^\+\d{8,15}$/.test(from)) {
      throw new HttpsError(
        "failed-precondition",
        "TWILIO_FROM must be an E.164-formatted phone number.",
      );
    }

    const accountSid = loadSecretValue("TWILIO_ACCOUNT_SID", "TWILIO_ACCOUNT_SID");
    const authToken = loadSecretValue("TWILIO_AUTH_TOKEN", "TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken) {
      throw new HttpsError(
        "failed-precondition",
        "Missing Twilio credentials. Verify bound secrets.",
      );
    }

    if (!twilio) {
      throw new HttpsError(
        "failed-precondition",
        "Twilio client library is not available.",
      );
    }

    const messageBody = buildMessage(item);

    if (dryRun) {
      await logSmsAttempt({
        type: "partnerInfo",
        itemId,
        to: normalizedTo,
        from,
        status: "dry-run",
        userId: auth?.uid || "unknown",
      });
      return {
        ok: true,
        dryRun: true,
        to: normalizedTo,
        bodyPreview: messageBody,
      };
    }

    const client = twilio(accountSid, authToken);

    try {
      const resp = await client.messages.create({ to: normalizedTo, from, body: messageBody });
      await logSmsAttempt({
        type: "partnerInfo",
        itemId,
        to: normalizedTo,
        from,
        sid: resp?.sid || null,
        status: resp?.status || "queued",
        userId: auth?.uid || "unknown",
      });
      return { ok: true, sid: resp?.sid || null, status: resp?.status || "queued" };
    } catch (error) {
      const mapped = mapTwilioError(error);
      logger.error("sendPartnerInfoSMS.twilioError", {
        error: error?.message || error,
        code: error?.code,
        status: error?.status,
        itemId,
        to: normalizedTo,
      });
      await logSmsAttempt({
        type: "partnerInfo",
        itemId,
        to: normalizedTo,
        from,
        status: "error",
        errorCode: error?.code || mapped.reason,
        errorMessage: error?.message || mapped.message,
        userId: auth?.uid || "unknown",
      });
      throw new HttpsError(mapped.statusCode, mapped.message, {
        twilioCode: error?.code,
        twilioStatus: error?.status,
        reason: mapped.reason,
      });
    }
  },
);
