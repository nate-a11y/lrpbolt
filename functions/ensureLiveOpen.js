/* Proprietary and confidential. See LICENSE. */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const { admin } = require("./_admin");

if (!global.__lrpGlobalOptionsSet) {
  try {
    setGlobalOptions({ region: "us-central1", cpu: 1, memory: "256MiB", timeoutSeconds: 60 });
    global.__lrpGlobalOptionsSet = true;
  } catch (error) {
    logger.warn("ensureLiveRideOpen:setGlobalOptions", error?.message || error);
  }
}

exports.ensureLiveRideOpen = onDocumentCreated("liveRides/{id}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data() || {};
  const status = String(data.status || "").trim().toLowerCase();
  const needsFix = status !== "open" || data.claimed === true || data.claimedBy;

  if (!needsFix) return;

  try {
    await snap.ref.set(
      {
        status: "open",
        claimed: false,
        claimedBy: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    logger.error("ensureLiveRideOpen:updateFailed", error?.message || error);
    throw error;
  }
});
