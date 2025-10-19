const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");
const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");

try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (err) {
  logger.warn("notifyQueue:init", err && (err.message || err));
}

const cfg = process.env || {};

const smsClient =
  cfg.TWILIO_ACCOUNT_SID && cfg.TWILIO_AUTH_TOKEN
    ? twilio(cfg.TWILIO_ACCOUNT_SID, cfg.TWILIO_AUTH_TOKEN)
    : null;

const mailer =
  cfg.SMTP_HOST && cfg.SMTP_USER
    ? nodemailer.createTransport({
        host: cfg.SMTP_HOST,
        port: Number(cfg.SMTP_PORT || 587),
        secure: Number(cfg.SMTP_PORT) === 465,
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
  const anchor = link ? `<p><a href="${link}">Open Ticket</a></p>` : "";
  return `<div style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.5">\n    <h3 style="margin:0 0 8px">${
      ticket?.title || "LRP Ticket"
    }</h3>\n    <div><b>ID:</b> ${ticket?.id || ""} &nbsp; | &nbsp; <b>Category:</b> ${
    ticket?.category || ""
  } &nbsp; | &nbsp; <b>Status:</b> ${
    ticket?.status || ""
  }</div>\n    ${desc}${anchor}\n  </div>`;
}

async function sendAllTargets(targets = [], ticket = {}, link) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return;
  }

  const subject = subjectFor(ticket);
  const text = `Ticket: ${ticket?.title || "LRP Ticket"}\nStatus: ${ticket?.status || ""}\n${ticket?.description || ""}\n${link || ""}`;
  const html = renderHTML(ticket, link);

  const messaging = admin.messaging();
  const tokens = targets
    .filter((t) => t && t.type === "fcm" && t.to)
    .map((t) => t.to);

  if (tokens.length) {
    await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: subject,
        body: ticket?.description || "",
      },
      data: {
        ticketId: String(ticket?.id || ""),
        category: String(ticket?.category || ""),
        status: String(ticket?.status || ""),
      },
    });
  }

  for (const target of targets) {
    if (!target?.type || !target?.to) continue;
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

exports.notifyQueueOnCreate = functions.firestore
  .document("notifyQueue/{id}")
  .onCreate(async (snap) => {
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

exports._sendAllTargets = sendAllTargets;
