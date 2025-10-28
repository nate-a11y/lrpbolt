/* Proprietary and confidential. See LICENSE. */
const admin = require("firebase-admin");

if (admin.apps.length === 0) admin.initializeApp();

const VALID_CATEGORIES = ["Promotions", "Premier Partners", "Referral Partners"];

async function run() {
  const db = admin.firestore();
  console.log("Fetching all importantInfo items...");

  const snapshot = await db.collection("importantInfo").get();
  console.log(`Found ${snapshot.size} total items`);

  const batch = db.batch();
  let migratedCount = 0;
  let skippedCount = 0;

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const category = String(data.category || "").trim();

    // If category is "General" or not in valid categories, update to "Promotions"
    if (category === "General" || !VALID_CATEGORIES.includes(category)) {
      console.log(`Migrating "${doc.id}" from "${category}" to "Promotions"`);
      batch.update(doc.ref, {
        category: "Promotions",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      migratedCount += 1;
    } else {
      skippedCount += 1;
    }
  });

  if (migratedCount > 0) {
    console.log(`\nCommitting batch update for ${migratedCount} items...`);
    await batch.commit();
    console.log("✅ Migration complete!");
  } else {
    console.log("\n✅ No items needed migration");
  }

  console.log(`\nSummary:`);
  console.log(`  - Migrated: ${migratedCount} items`);
  console.log(`  - Skipped: ${skippedCount} items (already valid)`);
}

run().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
