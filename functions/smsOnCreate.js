const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
  admin.initializeApp();
}

const TWILIO_SECRETS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
];

exports.smsOnCreate = onDocumentCreated(
  {
    document: "outboundMessages/{id}",
    secrets: TWILIO_SECRETS,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return null;
    }

    const msg = snapshot.data();
    if (!msg || msg.channel !== "sms") {
      return null;
    }

    const env = process.env;
    const missing = TWILIO_SECRETS.filter((key) => !env[key]);
    const fail = async (error) => {
      await snapshot.ref.update({
        status: "error",
        error:
          typeof error === "string"
            ? error
            : error?.response?.data
              ? JSON.stringify(error.response.data)
              : String(error?.message || error),
        lastTriedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    };

    if (missing.length) {
      return fail(`Missing Twilio env vars: ${missing.join(", ")}`);
    }
    if (!msg.to || !msg.body) {
      return fail("Missing to/body");
    }

    try {
      const client = axios.create({
        baseURL: `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}`,
        auth: { username: env.TWILIO_ACCOUNT_SID, password: env.TWILIO_AUTH_TOKEN },
        timeout: 12000,
      });

      const form = new URLSearchParams({ To: msg.to, Body: msg.body });
      if (String(env.TWILIO_FROM).startsWith("MG")) {
        form.set("MessagingServiceSid", env.TWILIO_FROM);
      } else {
        form.set("From", env.TWILIO_FROM);
      }

      const { data } = await client.post("/Messages.json", form);

      await snapshot.ref.update({
        status: "sent",
        provider: "twilio",
        providerMessageId: data.sid,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    } catch (err) {
      logger.error("smsOnCreate failed", { err });
      return fail(err);
    }
  },
);
