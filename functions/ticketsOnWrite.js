const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions, logger } = require("firebase-functions/v2");

const { admin } = require("./_admin");
const { sendAllTargets } = require("./notifyQueue"); // re-use our unified sender
const { resolveEmailFromId } = require("./_assignees");

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

async function resolveEmails(db, candidates = []) {
  const emails = new Set();
  const toResolve = [];
  const seenKeys = new Set();

  for (const rawCandidate of candidates) {
    if (!rawCandidate) continue;
    const candidate = String(rawCandidate).trim();
    if (!candidate) continue;
    if (candidate.includes("@")) {
      emails.add(candidate.toLowerCase());
      continue;
    }
    const aliasEmail = resolveEmailFromId(candidate);
    if (aliasEmail) {
      emails.add(aliasEmail);
      continue;
    }
    const key = candidate.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    toResolve.push(candidate);
  }

  if (!toResolve.length) {
    return Array.from(emails);
  }

  const lookups = await Promise.allSettled(
    toResolve.map(async (key) => {
      try {
        const accessSnap = await db.doc(`userAccess/${key}`).get();
        if (accessSnap.exists) {
          const emailFromAccess = (accessSnap.data()?.email || "")
            .toString()
            .trim()
            .toLowerCase();
          if (emailFromAccess && emailFromAccess.includes("@")) {
            return emailFromAccess;
          }
        }

        const userSnap = await db.doc(`users/${key}`).get();
        if (userSnap.exists) {
          const emailFromUser = (userSnap.data()?.email || "")
            .toString()
            .trim()
            .toLowerCase();
          if (emailFromUser && emailFromUser.includes("@")) {
            return emailFromUser;
          }
        }
      } catch (error) {
        logger.warn("ticketsOnWrite:resolveEmails", {
          key,
          err: error?.message || error,
        });
      }
      return "";
    }),
  );

  lookups.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const email = String(result.value || "").trim().toLowerCase();
    if (email && email.includes("@")) {
      emails.add(email);
    }
  });

  return Array.from(emails);
}

async function resolveUidsFromEmails(auth, emails = []) {
  const uids = new Set();
  if (!emails.length) return Array.from(uids);
  const lookups = emails.map((email) => auth.getUserByEmail(email));
  const results = await Promise.allSettled(lookups);
  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value?.uid) {
      uids.add(result.value.uid);
    }
  });
  return Array.from(uids);
}

async function fetchFcmTokensForRecipients(db, { emails = [], uids = [] } = {}) {
  const tokens = new Set();

  const chunk = (values = []) => {
    const slices = [];
    for (let i = 0; i < values.length; i += 10) {
      slices.push(values.slice(i, i + 10));
    }
    return slices;
  };

  for (const group of chunk(emails)) {
    if (!group.length) continue;
    const snap = await db.collection("fcmTokens").where("email", "in", group).get();
    snap.docs.forEach((doc) => {
      const token = doc.data()?.token || doc.id;
      if (token) tokens.add(String(token));
    });
  }

  for (const group of chunk(uids)) {
    if (!group.length) continue;
    const snap = await db.collection("fcmTokens").where("userId", "in", group).get();
    snap.docs.forEach((doc) => {
      const token = doc.data()?.token || doc.id;
      if (token) tokens.add(String(token));
    });
  }

  return Array.from(tokens);
}

// IMPORTANT: tickets live in the 'issueTickets' collection
exports.ticketsOnWrite = onDocumentWritten("issueTickets/{id}", async (event) => {
  const db = admin.firestore();
  const auth = admin.auth();
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

  if (!created && !statusChanged && !assigneeChanged) {
    logger.debug("ticketsOnWrite: no-op change", { id: event.params?.id });
    return;
  }

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
    logger.info("ticketsOnWrite: change detected", {
      id,
      created,
      statusChanged,
      assigneeChanged,
      status: ticket.status,
      assignee: after?.assignee || null,
    });
    const candidates = collectCandidateEmails(after);
    const emails = await resolveEmails(db, candidates);
    const uids = await resolveUidsFromEmails(auth, emails);
    const fcmTokens = await fetchFcmTokensForRecipients(db, { emails, uids });

    const targets = [];
    // FCM
    fcmTokens.forEach((t) => targets.push({ type: "fcm", to: t }));
    // Email (notify all)
    emails.forEach((e) => targets.push({ type: "email", to: e }));

    logger.info("ticketsOnWrite:recipients", {
      id,
      emails,
      uids,
      fcmTokensCount: fcmTokens.length,
    });

    if (targets.length === 0) {
      logger.warn("ticketsOnWrite:no-targets", { id });
      return;
    }
    await sendAllTargets(targets, ticket, link);
  } catch (err) {
    logger.error("ticketsOnWrite v2 failed", { err: err?.message || err, id });
  }
});

module.exports = { ticketsOnWrite: exports.ticketsOnWrite };
