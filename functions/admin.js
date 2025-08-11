// TODO: move credentials to Secret Manager; keep default app init for now.
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
  admin.initializeApp();
}
module.exports = { admin };
