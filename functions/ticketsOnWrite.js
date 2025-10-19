const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const { admin } = require("./_admin");
const { sendAllTargets } = require("./notifyQueue"); // re-use our unified sender

if (!global.__lrpGlobalOptionsSet) {
  try {
    setGlobalOptions({ region: "us-central1", cpu: 1, memory: "256MiB", timeoutSeconds: 60 });
    global.__lrpGlobalOptionsSet = true;
  } catch (error) {
    logger.warn("ticketsOnWrite:setGlobalOptions", error?.message || error);
  }
}

// Build email list from ticket doc (createdBy, assignee, watchers[])
function collectCandidateEmails(doc = {}) {
  const out = new Set();
  const pushMaybe = (v) => {
    if (!v) return;
    const s = String(v).trim();
    if (!s) return;
    // if it's clearly an email, add directly
    if (s.includes("@")) out.add(s.toLowerCase());
    else out.add(s); // treat as user key; we'll resolve via userAccess
  };
  pushMaybe(doc?.createdBy?.email);
  pushMaybe(doc?.createdBy?.userId);
  pushMaybe(doc?.assignee?.email);
  pushMaybe(doc?.assignee?.userId);
  if (Array.isArray(doc?.watchers)) doc.watchers.forEach(pushMaybe);
  return Array.from(out);
}

async function resolveEmails(db, candidates) {
  const emails = new Set();
  // Split into obvious emails vs keys we need to resolve in userAccess
  const toResolve = [];
  for (const c of candidates) {
    if (c.includes("@")) emails.add(c.toLowerCase());
    else toResolve.push(c);
  }
  // Resolve userAccess/<key> → .email (if present)
  if (toResolve.length) {
    const reads = toResolve.map((k) => db.doc(`userAccess/${k}`).get());
    const snaps = await Promise.allSettled(reads);
    for (const r of snaps) {
      if (r.status !== "fulfilled") continue;
      const s = r.value;
      if (!s.exists) continue;
      const e = (s.data()?.email || s.id || "").toString().trim().toLowerCase();
      if (e && e.includes("@")) emails.add(e);
    }
  }
  return Array.from(emails);
}

async function fetchFcmTokensForEmails(db, emails) {
  // Firestore "in" is limited to 10 values. Chunk queries.
  const chunks = [];
  for (let i = 0; i < emails.length; i += 10) chunks.push(emails.slice(i, i + 10));
  const tokens = new Set();
  for (const group of chunks) {
    const qs = await db.collection("fcmTokens").where("email", "in", group).get();
    qs.docs.forEach((d) => {
      const t = d.data()?.token || d.id; // support legacy where docId was token
      if (t) tokens.add(String(t));
    });
  }
  return Array.from(tokens);
}

exports.ticketsOnWrite = onDocumentWritten("tickets/{id}", async (event) => {
  const db = admin.firestore();
  if (!event?.data) return;
  const beforeExists = event.data.before.exists;
  const afterExists = event.data.after.exists;
  if (!afterExists) return; // deleted – ignore

  const before = beforeExists ? event.data.before.data() : null;
  const after = event.data.after.data() || {};

  const created = !beforeExists && afterExists;
  const statusChanged = before && after && before.status !== after.status;
  const assigneeChanged =
    (before?.assignee?.userId || before?.assignee?.email || "") !==
    (after?.assignee?.userId || after?.assignee?.email || "");

  if (!created && !statusChanged && !assigneeChanged) return;

  const id = event.params.id;
  const link = `https://lakeridepros.xyz/#/tickets?id=${id}`;
  const ticket = {
    id,
    title: after.title || "Support Ticket",
    description: after.description || "",
    status: after.status || "open",
    category: after.category || "general",
  };

  try {
    const candidates = collectCandidateEmails(after);
    const emails = await resolveEmails(db, candidates);
    const fcmTokens = await fetchFcmTokensForEmails(db, emails);

    const targets = [];
    // FCM
    fcmTokens.forEach((t) => targets.push({ type: "fcm", to: t }));
    // Email (notify all)
    emails.forEach((e) => targets.push({ type: "email", to: e }));

    if (targets.length === 0) return;
    await sendAllTargets(targets, ticket, link);
  } catch (err) {
    logger.error("ticketsOnWrite v2 failed", { err: err?.message || err, id });
    throw err;
  }
});

module.exports = { ticketsOnWrite: exports.ticketsOnWrite };
