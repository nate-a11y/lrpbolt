const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");

const { admin } = require("./_admin");

let twilio = null;
try {
  twilio = require("twilio");
} catch (err) {
  logger.warn("notifyQueue:twilio-missing", err?.message || err);
}

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (err) {
  logger.warn("notifyQueue:nodemailer-missing", err?.message || err);
}

const cfg = process.env || {};

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

function subjectFor(ticket) {
  const base = ticket?.title || "LRP Ticket";
  const suffix = ticket?.status ? ` (${ticket.status})` : "";
  return `[LRP] ${base}${suffix}`;
}

function renderHTML(ticket, link) {
  const desc = ticket?.description ? `<p>${ticket.description}</p>` : "";
  const anchor = link ? `<p><a href='${link}'>Open Ticket</a></p>` : "";
  return `<div style='font-family:system-ui,Segoe UI,sans-serif;line-height:1.5'>
    <h3 style='margin:0 0 8px'>${ticket?.title || "LRP Ticket"}</h3>
    <div><b>ID:</b> ${ticket?.id || ""} &nbsp; | &nbsp; <b>Category:</b> ${ticket?.category || ""} &nbsp; | &nbsp; <b>Status:</b> ${ticket?.status || ""}</div>
    ${desc}${anchor}
  </div>`;
}

async function sendAllTargets(targets = [], ticket = {}, link) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return;
  }

  const filtered = targets.filter((t) => t && t.type && t.to);
  if (!filtered.length) {
    return;
  }

  const subject = subjectFor(ticket);
  const text = `Ticket: ${ticket?.title || "LRP Ticket"}\nStatus: ${
    ticket?.status || ""
  }\n${ticket?.description || ""}\n${link || ""}`;
  const html = renderHTML(ticket, link);

  const messaging = admin.messaging();
  const fcmTokens = new Set();
  filtered
    .filter((t) => t.type === "fcm")
    .forEach((t) => {
      if (t.to) fcmTokens.add(t.to);
    });

  if (fcmTokens.size) {
    await messaging.sendEachForMulticast({
      tokens: Array.from(fcmTokens),
      notification: { title: subject, body: ticket?.description || "" },
      data: {
        ticketId: String(ticket?.id || ""),
        category: String(ticket?.category || ""),
        status: String(ticket?.status || ""),
      },
    });
  }

  for (const target of filtered) {
    if (target.type === "email" && mailer) {
      await mailer.sendMail({
        to: target.to,
        from: cfg.SMTP_USER,
        subject,
        text,
        html,
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

const notifyQueueOnCreate = onDocumentCreated("notifyQueue/{id}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data() || {};
  const ctx = data.context || {};
  const targets = Array.isArray(data.targets) ? data.targets : [];

  try {
    await sendAllTargets(targets, ctx.ticket, ctx.link);
    await snap.ref.update({ status: "sent" });
  } catch (err) {
    logger.error("notifyQueueOnCreate", {
      err: err && (err.stack || err.message || err),
    });
    await snap.ref.update({
      status: "error",
      error: err?.message || String(err),
    });
  }
});

module.exports = {
  notifyQueueOnCreate,
  sendAllTargets,
  _sendAllTargets: sendAllTargets,
};
