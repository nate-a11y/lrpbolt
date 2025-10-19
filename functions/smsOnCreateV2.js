const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");
const twilio = require("twilio");
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

  await twilio(sid, token).messages.create({
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
