const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");

const { admin } = require("./_admin");

const migrateIssueTickets = onCall({ region: "us-central1", invoker: "public" }, async (request) => {
  const token = request?.auth?.token || {};
  if (!token.admin && token.role !== "admin") {
    throw new Error("permission-denied: Admin only");
  }

  const db = admin.firestore();
  const moved = [];
  const snap = await db.collection("tickets").get();

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const looksLikeIssue = data.status && data.assignee && !data.passengerName && !data.qrCode;
    const already = data.migratedToIssueTickets === true;
    if (!looksLikeIssue || already) continue;

    await db.collection("issueTickets").doc(doc.id).set(data, { merge: true });
    await doc.ref.set({ migratedToIssueTickets: true }, { merge: true });
    moved.push(doc.id);
  }

  logger.info("migrated", { count: moved.length });
  return { movedCount: moved.length, movedIds: moved };
});

module.exports = { migrateIssueTickets };
