const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");

const { admin } = require("./_admin");
const { sendAllTargets } = require("./notifyQueue");

function diffChanged(before, after, keys = []) {
  if (!before) return true;
  return keys.some((key) => {
    const prev = before?.[key];
    const next = after?.[key];
    try {
      return JSON.stringify(prev) !== JSON.stringify(next);
    } catch (error) {
      logger.debug?.("ticketsV2:diffFallback", { key, error });
      return prev !== next;
    }
  });
}

function slaMinutesForPriority(priority) {
  switch (String(priority || "normal").toLowerCase()) {
    case "urgent":
      return 120;
    case "high":
      return 480;
    case "low":
      return 72 * 60;
    default:
      return 24 * 60;
  }
}

function buildLink(ticketId) {
  const origin = process.env.LRP_ORIGIN || "https://lakeridepros.xyz";
  return `${origin}/#/tickets?id=${ticketId}`;
}

function toMillis(value) {
  if (!value) return null;
  try {
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value?._seconds === "number") return value._seconds * 1000;
  } catch (error) {
    logger.warn("ticketsV2:toMillis", {
      err: error && (error.stack || error.message || error),
    });
  }
  return null;
}

async function targetsForUsers(db, userIds = []) {
  const dedupEmail = new Set();
  const dedupPhone = new Set();
  const dedupFcm = new Set();
  const results = [];

  for (const uid of userIds) {
    if (!uid) continue;
    try {
      const [userSnap, accessSnap] = await Promise.all([
        db.doc(`users/${uid}`).get(),
        db.doc(`userAccess/${uid}`).get(),
      ]);
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const accessData = accessSnap.exists ? accessSnap.data() || {} : {};

      const email =
        (userData.email || userData.contactEmail || null) || accessData.email ||
        null;
      const phone =
        (userData.phone || userData.phoneNumber || null) || accessData.phone ||
        null;

      if (email && !dedupEmail.has(email)) {
        dedupEmail.add(email);
        results.push({ type: "email", to: email });
      }
      if (phone && !dedupPhone.has(phone)) {
        dedupPhone.add(phone);
        results.push({ type: "sms", to: phone });
      }

      if (email) {
        const tokenSnap = await db
          .collection("fcmTokens")
          .where("email", "==", email)
          .get();
        tokenSnap.forEach((docSnap) => {
          const tokenId = docSnap.id;
          if (!tokenId || dedupFcm.has(tokenId)) return;
          dedupFcm.add(tokenId);
          results.push({ type: "fcm", to: tokenId });
        });
      }
    } catch (error) {
      logger.error("ticketsV2:targetsForUsers", {
        uid,
        err: error && (error.stack || error.message || error),
      });
    }
  }

  return results;
}

async function latestCommentDescription(ref, fallback, ticketId) {
  try {
    const commentSnap = await ref
      .collection("comments")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (!commentSnap.empty) {
      const latest = commentSnap.docs[0].data() || {};
      if (latest.body) {
        return `New comment: ${latest.body}`;
      }
    }
  } catch (error) {
    logger.warn("ticketsV2:commentLookup", {
      ticketId,
      err: error && (error.stack || error.message || error),
    });
  }
  return fallback || "";
}

const ticketsOnWrite = onDocumentWritten("issueTickets/{id}", async (event) => {
  const db = admin.firestore();
  if (!event.data) return;

  const after = event.data.after.exists ? event.data.after.data() : null;
  const before = event.data.before.exists ? event.data.before.data() : null;
  const ticketId = event.params.id;

  if (!after) return;

  const slaMinutes = slaMinutesForPriority(after.priority);
  const createdMs = toMillis(after.createdAt) || Date.now();
  const breachAtMs = createdMs + slaMinutes * 60 * 1000;

  if (!after?.sla?.breachAt) {
    try {
      await event.data.after.ref.set(
        {
          sla: {
            minutes: slaMinutes,
            breachAt: admin.firestore.Timestamp.fromMillis(breachAtMs),
          },
        },
        { merge: true },
      );
    } catch (error) {
      logger.error("ticketsV2:updateSla", {
        ticketId,
        err: error && (error.stack || error.message || error),
      });
    }
  }

  const importantChanged = diffChanged(before, after, [
    "status",
    "assignee",
    "priority",
    "lastCommentAt",
  ]);

  if (!importantChanged) return;

  const creatorId = after?.createdBy?.userId || null;
  const assigneeId = after?.assignee?.userId || null;
  const watcherIds = Array.isArray(after?.watchers) ? after.watchers : [];
  const uniqueUserIds = Array.from(
    new Set([creatorId, assigneeId, ...watcherIds].filter(Boolean)),
  );

  if (!uniqueUserIds.length) return;

  const targets = await targetsForUsers(db, uniqueUserIds);
  if (!targets.length) return;

  let description = after.description || "";
  if (diffChanged(before, after, ["lastCommentAt"])) {
    description = await latestCommentDescription(
      event.data.after.ref,
      description,
      ticketId,
    );
  }

  const payload = {
    id: ticketId,
    title: after.title,
    description,
    category: after.category,
    status: after.status,
  };

  try {
    await sendAllTargets(targets, payload, buildLink(ticketId));
  } catch (error) {
    logger.error("ticketsV2:notify", {
      ticketId,
      err: error && (error.stack || error.message || error),
    });
  }
});

const slaSweep = onSchedule("every 10 minutes", async () => {
  const db = admin.firestore();
  const now = Date.now();

  const snapshot = await db
    .collection("issueTickets")
    .where("status", "in", ["open", "in_progress"])
    .get();

  const pending = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const breachAt = toMillis(data?.sla?.breachAt);
    if (breachAt && breachAt < now && data.status !== "breached") {
      pending.push({ id: docSnap.id, ticket: data });
    }
  });

  for (const row of pending) {
    try {
      await db.doc(`issueTickets/${row.id}`).set(
        {
          status: "breached",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const watchers = Array.isArray(row.ticket?.watchers)
        ? row.ticket.watchers
        : [];
      const userIds = Array.from(
        new Set([
          row.ticket?.createdBy?.userId,
          row.ticket?.assignee?.userId,
          ...watchers,
        ].filter(Boolean)),
      );
      const targets = await targetsForUsers(db, userIds);
      if (!targets.length) continue;

      await sendAllTargets(
        targets,
        { id: row.id, ...row.ticket, status: "breached" },
        buildLink(row.id),
      );
    } catch (error) {
      logger.error("ticketsV2:slaSweep", {
        ticketId: row.id,
        err: error && (error.stack || error.message || error),
      });
    }
  }
});

module.exports = { ticketsOnWrite, slaSweep };
