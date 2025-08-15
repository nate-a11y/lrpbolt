const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

try {
  admin.initializeApp();
} catch (e) {
  void e;
}
const db = admin.firestore();
void db;

exports.smsOnCreate = functions
  .runWith({ secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"] })
  // .region("us-central1") // uncomment if you want a specific region
  .firestore.document("outboundMessages/{id}")
  .onCreate(async (snap, ctx) => {
    void ctx;
    const msg = snap.data();

    const env = process.env;
    const missing = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"].filter(k => !env[k]);
    const fail = async (error) => {
      await snap.ref.update({
        status: "error",
        error: typeof error === "string" ? error :
               error?.response?.data ? JSON.stringify(error.response.data) :
               String(error?.message || error),
        lastTriedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    };

    if (!msg || msg.channel !== "sms") return null;
    if (missing.length) return fail(`Missing Twilio env vars: ${missing.join(", ")}`);
    if (!msg.to || !msg.body) return fail("Missing to/body");

    try {
      const client = axios.create({
        baseURL: `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}`,
        auth: { username: env.TWILIO_ACCOUNT_SID, password: env.TWILIO_AUTH_TOKEN },
        timeout: 12000,
      });

      const form = new URLSearchParams({ To: msg.to, Body: msg.body });
      if (String(env.TWILIO_FROM).startsWith("MG")) form.set("MessagingServiceSid", env.TWILIO_FROM);
      else form.set("From", env.TWILIO_FROM);

      const { data } = await client.post("/Messages.json", form);

      await snap.ref.update({
        status: "sent",
        provider: "twilio",
        providerMessageId: data.sid,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    } catch (err) {
      return fail(err);
    }
  });
