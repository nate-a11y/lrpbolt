/* Proprietary and confidential. See LICENSE. */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.ensureLiveRideOpen = functions.firestore
  .document("liveRides/{id}")
  .onCreate(async (snap) => {
    const data = snap.data() || {};
    const status = String(data.status || "").trim().toLowerCase();
    const needsFix = status !== "open" || data.claimed === true || data.claimedBy;

    if (!needsFix) return null;

    return snap.ref.set(
      {
        status: "open",
        claimed: false,
        claimedBy: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
