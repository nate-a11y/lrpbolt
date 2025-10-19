const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");

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
      if (typeof logger.debug === "function") {
        logger.debug("ticketsOnWrite:diffFallback", { key, error });
      }
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
    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }
    if (typeof value.toDate === "function") {
      return value.toDate().getTime();
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value._seconds === "number") {
      return value._seconds * 1000;
    }
  } catch (err) {
    logger.warn("ticketsOnWrite:toMillis", {
      value,
      err: err && (err.message || err),
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
    } catch (err) {
      logger.error("ticketsOnWrite:targetsForUsers", {
        uid,
        err: err && (err.stack || err.message || err),
      });
    }
  }

  return results;
}

exports.ticketsOnWrite = functions.firestore
  .document("issueTickets/{id}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    const ticketId = context.params.id;

    if (!after) {
      return null;
    }

    const db = admin.firestore();

    // Maintain SLA deadline metadata
    const slaMinutes = slaMinutesForPriority(after.priority);
    const createdMs = toMillis(after.createdAt) || Date.now();
    const breachAtMs = createdMs + slaMinutes * 60 * 1000;
    const shouldPatchSla = !after.sla || !after.sla.breachAt;

    if (shouldPatchSla) {
      try {
        await change.after.ref.set(
          {
            sla: {
              minutes: slaMinutes,
              breachAt: admin.firestore.Timestamp.fromMillis(breachAtMs),
            },
          },
          { merge: true },
        );
      } catch (err) {
        logger.error("ticketsOnWrite:updateSla", {
          ticketId,
          err: err && (err.stack || err.message || err),
        });
      }
    }

    const importantChanged = diffChanged(before, after, [
      "status",
      "assignee",
      "priority",
      "lastCommentAt",
    ]);

    if (!importantChanged) {
      return null;
    }

    const creatorId = after?.createdBy?.userId || null;
    const assigneeId = after?.assignee?.userId || null;
    const watcherIds = Array.isArray(after?.watchers) ? after.watchers : [];
    const uniqueUserIds = Array.from(
      new Set([creatorId, assigneeId, ...watcherIds].filter(Boolean)),
    );

    if (!uniqueUserIds.length) {
      return null;
    }

    const targets = await targetsForUsers(db, uniqueUserIds);
    if (!targets.length) {
      return null;
    }

    let description = after.description || "";
    if (diffChanged(before, after, ["lastCommentAt"])) {
      try {
        const commentSnap = await change.after.ref
          .collection("comments")
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();
        if (!commentSnap.empty) {
          const latest = commentSnap.docs[0].data() || {};
          if (latest.body) {
            description = `New comment: ${latest.body}`;
          }
        }
      } catch (err) {
        logger.warn("ticketsOnWrite:commentLookup", {
          ticketId,
          err: err && (err.stack || err.message || err),
        });
      }
    }

    const ticketPayload = {
      id: ticketId,
      title: after.title,
      description,
      category: after.category,
      status: after.status,
    };

    try {
      await sendAllTargets(targets, ticketPayload, buildLink(ticketId));
    } catch (err) {
      logger.error("ticketsOnWrite:notify", {
        ticketId,
        err: err && (err.stack || err.message || err),
      });
    }

    return null;
  });

exports.slaSweep = functions.pubsub
  .schedule("every 10 minutes")
  .onRun(async () => {
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

    for (const item of pending) {
      try {
        await db.doc(`issueTickets/${item.id}`).set(
          {
            status: "breached",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        const watchers = Array.isArray(item.ticket?.watchers)
          ? item.ticket.watchers
          : [];
        const userIds = Array.from(
          new Set([
            item.ticket?.createdBy?.userId,
            item.ticket?.assignee?.userId,
            ...watchers,
          ].filter(Boolean)),
        );
        const targets = await targetsForUsers(db, userIds);
        if (targets.length) {
          await sendAllTargets(
            targets,
            { id: item.id, ...item.ticket, status: "breached" },
            buildLink(item.id),
          );
        }
      } catch (err) {
        logger.error("ticketsOnWrite:slaSweep", {
          ticketId: item.id,
          err: err && (err.stack || err.message || err),
        });
      }
    }

    return null;
  });
