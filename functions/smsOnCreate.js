const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

try { admin.initializeApp(); } catch { /* already initialized */ }

exports.smsOnCreate = functions.firestore
  .document("outboundMessages/{id}")
  .onCreate(async (snap) => {
    const msg = snap.data();

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
    if (!msg || msg.channel !== "sms") return null;

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

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      return fail("Missing Twilio env vars");
    }
    if (!msg.to || !msg.body) {
      return fail("Missing to/body");
    }

    try {
      const client = axios.create({
        baseURL: `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`,
        auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
        timeout: 12000,
      });

      const form = new URLSearchParams({
        To: msg.to,
        Body: msg.body,
      });
      if (String(TWILIO_FROM).startsWith("MG")) form.set("MessagingServiceSid", TWILIO_FROM);
      else form.set("From", TWILIO_FROM);

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
