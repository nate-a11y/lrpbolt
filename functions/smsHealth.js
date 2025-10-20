const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const { admin } = require("./admin");

const REGION = "us-central1";

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = defineSecret("TWILIO_FROM");

function readSecret(secret, label) {
  try {
    const value = secret?.value?.();
    if (typeof value !== "string") return { present: false, value: null };
    const trimmed = value.trim();
    if (!trimmed) {
      logger.warn("smsHealth.secretEmpty", { label });
      return { present: false, value: null };
    }
    return { present: true, value: trimmed };
  } catch (error) {
    logger.error("smsHealth.secretReadFailed", { label, error });
    return { present: false, value: null };
  }
}

function getProjectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  if (process.env.FIREBASE_CONFIG) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_CONFIG);
      if (parsed?.projectId) return parsed.projectId;
    } catch (error) {
      logger.warn("smsHealth.projectIdParseFailed", { error });
    }
  }
  return null;
}

function getRuntimeRegion() {
  return (
    process.env.FUNCTION_REGION ||
    process.env.GCLOUD_REGION ||
    process.env.GCP_REGION ||
    process.env.X_GOOGLE_RUNTIMEREGION ||
    null
  );
}

async function fetchLastError() {
  try {
    const snap = await admin
      .firestore()
      .collection("smsLogs")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    if (snap.empty) return null;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data || data.status !== "error") continue;
      const createdAt = data?.createdAt?.toDate?.();
      return {
        id: doc.id,
        itemId: data?.itemId || null,
        to: data?.to || null,
        errorCode: data?.errorCode || null,
        errorMessage: data?.errorMessage || "Unknown error",
        createdAt: createdAt ? createdAt.toISOString() : null,
      };
    }
    return null;
  } catch (error) {
    logger.error("smsHealth.fetchLastErrorFailed", { error });
    return null;
  }
}

exports.smsHealth = onCall(
  {
    region: REGION,
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM],
    cors: true,
    enforceAppCheck: false,
  },
  async (request) => {
    const sidSecret = readSecret(TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID");
    const tokenSecret = readSecret(TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN");
    const fromSecret = readSecret(TWILIO_FROM, "TWILIO_FROM");
    const fromValid = fromSecret.present && /^\+\d{8,15}$/.test(fromSecret.value);

    const runtimeRegion = getRuntimeRegion();
    const secretsReady = sidSecret.present && tokenSecret.present && fromValid;
    const regionOk = runtimeRegion ? runtimeRegion === REGION : true;

    const lastError = await fetchLastError();

    return {
      ok: secretsReady && regionOk,
      checkedAt: new Date().toISOString(),
      projectId: getProjectId(),
      region: {
        configured: REGION,
        runtime: runtimeRegion,
        matches: regionOk,
      },
      secrets: {
        TWILIO_ACCOUNT_SID: sidSecret.present,
        TWILIO_AUTH_TOKEN: tokenSecret.present,
        TWILIO_FROM: {
          present: fromSecret.present,
          e164: fromValid,
        },
      },
      lastError,
      auth: {
        uid: request.auth?.uid || null,
        admin: request.auth?.token?.admin === true,
      },
    };
  },
);
