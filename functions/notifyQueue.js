const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger, setGlobalOptions } = require("firebase-functions/v2");
const { admin } = require("./_admin");

if (!global.__lrpGlobalOptionsSet) {
  try {
    setGlobalOptions({ region: "us-central1", cpu: 1 });
    global.__lrpGlobalOptionsSet = true;
  } catch (error) {
    logger.warn("notifyQueue:setGlobalOptions", error?.message || error);
  }
}

let twilio = null;
try {
  twilio = require("twilio");
} catch (error) {
  logger.warn("notifyQueue:twilio-missing", error?.message || error);
}

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (error) {
  logger.warn("notifyQueue:nodemailer-missing", error?.message || error);
}

const cfg = process.env;

const smsClient =
  twilio && cfg.TWILIO_ACCOUNT_SID && cfg.TWILIO_AUTH_TOKEN
    ? twilio(cfg.TWILIO_ACCOUNT_SID, cfg.TWILIO_AUTH_TOKEN)
    : null;

const mailer =
  nodemailer && cfg.SMTP_HOST && cfg.SMTP_USER
    ? nodemailer.createTransport({
        host: cfg.SMTP_HOST,
        port: Number(cfg.SMTP_PORT || 587),
        secure: String(cfg.SMTP_PORT || "") === "465",
        auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
      })
    : null;

function renderHtml(ticket, link) {
  return `
    <div style="font-family:sans-serif">
      <h3>${ticket?.title || "LRP Ticket"}</h3>
      <p>${ticket?.description || ""}</p>
      ${link ? `<a href="${link}">Open Ticket</a>` : ""}
    </div>
  `;
}

async function sendAllTargets(targets, ticket, link) {
  const title = `[LRP] ${ticket?.title || "Ticket"}${
    ticket?.status ? ` (${ticket.status})` : ""
  }`;
  const text = `${ticket?.description || ""}\n${link || ""}`.trim();
  const tokens = [
    ...new Set((targets || []).filter((t) => t.type === "fcm").map((t) => t.to)),
  ].filter(Boolean);

  if (tokens.length) {
    await admin
      .messaging()
      .sendEachForMulticast({
        tokens,
        notification: { title, body: ticket?.description || "" },
      });
  }

  for (const target of targets || []) {
    if (target.type === "email" && mailer) {
      await mailer.sendMail({
        to: target.to,
        from: cfg.SMTP_USER,
        subject: title,
        text,
        html: renderHtml(ticket, link),
      });
    }
    if (target.type === "sms" && smsClient) {
      await smsClient.messages.create({
        to: target.to,
        from: cfg.TWILIO_FROM,
        body: text,
      });
    }
  }
}

const notifyQueueOnCreate = onDocumentCreated(
  "notifyQueue/{id}",
  async (event) => {
    const data = event.data?.data() || {};
    const ctx = data.context || {};

    try {
      await sendAllTargets(data.targets || [], ctx.ticket, ctx.link);
      await event.data.ref.update({ status: "sent" });
    } catch (error) {
      logger.error("notifyQueue", error?.message || error);
      await event.data.ref.update({
        status: "error",
        error: error?.message || "error",
      });
    }
  },
);

exports.notifyQueueOnCreate = notifyQueueOnCreate;
module.exports = { notifyQueueOnCreate, sendAllTargets };
