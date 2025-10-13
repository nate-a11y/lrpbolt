/* Proprietary and confidential. See LICENSE. */
const admin = require("firebase-admin");

if (admin.apps.length === 0) admin.initializeApp();

async function run() {
  const db = admin.firestore();
  const bad = await db.collection("liveRides").get();

  const batch = db.batch();
  let count = 0;
  bad.forEach((doc) => {
    const d = doc.data() || {};
    const s = String(d.status || "").trim().toLowerCase();
    const claimed = d.claimed === true || !!d.claimedBy;
    if (s === "queued" || s === "queue" || claimed) {
      batch.set(
        doc.ref,
        {
          status: "open",
          claimed: false,
          claimedBy: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      count += 1;
    }
  });

  if (count > 0) await batch.commit();
  console.log(`Backfilled ${count} liveRides → open`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
