const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");
let twilioFactory = null;
try {
  // eslint-disable-next-line global-require
  twilioFactory = require("twilio");
} catch (error) {
  logger.warn("smsOnCreateV2:twilio-missing", error?.message || error);
}
const { admin } = require("./_admin");

const accountSidSecret = defineSecret("TWILIO_ACCOUNT_SID");
const authTokenSecret = defineSecret("TWILIO_AUTH_TOKEN");
const fromNumberSecret = defineSecret("TWILIO_FROM");

async function deliverSms(payload) {
  const sid = accountSidSecret.value();
  const token = authTokenSecret.value();
  const from = fromNumberSecret.value();

  if (!sid || !token || !from) {
    throw new Error("Twilio secrets are not configured");
  }

  if (!twilioFactory) {
    logger.warn("smsOnCreateV2:twilio-unavailable", {
      reason: "twilio dependency not installed",
      to: payload.to,
    });
    return;
  }

  await twilioFactory(sid, token).messages.create({
    to: payload.to,
    from,
    body: payload.body,
  });
}

const smsOnCreateV2 = onDocumentCreated(
  {
    document: "outboundMessages/{id}",
    region: "us-central1",
    secrets: [accountSidSecret, authTokenSecret, fromNumberSecret],
  },
  async (event) => {
    const data = event.data?.data();

    if (!data?.to || !data?.body) {
      logger.warn("smsOnCreateV2:skip", { reason: "missing payload", id: event?.params?.id });
      return;
    }

    try {
      await deliverSms(data);
      await event.data.ref.set(
        {
          status: "sent",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      logger.error("smsOnCreateV2:error", error?.message || error);
      await event.data.ref.set(
        {
          status: "error",
          error: error?.message || "sms-send-failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  },
);

module.exports = { smsOnCreateV2 };
