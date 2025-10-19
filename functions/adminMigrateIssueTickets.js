const functions = require("firebase-functions");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (err) {
  logger.warn("adminMigrate:init", err && (err.message || err));
}

exports.migrateIssueTickets = functions.https.onCall(async (data, context) => {
  const isAdmin =
    context?.auth?.token?.admin === true ||
    context?.auth?.token?.role === "admin";
  if (!isAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const db = admin.firestore();
  const moved = [];
  const snapshot = await db.collection("tickets").get();

  for (const docSnap of snapshot.docs) {
    const record = docSnap.data() || {};
    const looksLikeIssue =
      record.status && record.assignee && !record.passengerName && !record.qrCode;
    const already = record.migratedToIssueTickets === true;
    if (!looksLikeIssue || already) {
      continue;
    }

    try {
      await db.collection("issueTickets").doc(docSnap.id).set(record, { merge: true });
      await docSnap.ref.set({ migratedToIssueTickets: true }, { merge: true });
      moved.push(docSnap.id);
    } catch (err) {
      logger.error("adminMigrate:moveFailed", {
        id: docSnap.id,
        err: err && (err.stack || err.message || err),
      });
    }
  }

  return { movedCount: moved.length, movedIds: moved };
});
