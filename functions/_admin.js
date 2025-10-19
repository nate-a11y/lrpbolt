const admin = require("firebase-admin");

try {
  admin.app();
} catch {
  admin.initializeApp();
}

module.exports = { admin };
