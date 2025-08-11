import admin from "firebase-admin";

if (!admin.apps.length) {
  // TODO: move service account / params to Secret Manager (keep as-is for now)
  admin.initializeApp();
}

const db = admin.firestore();

export { admin, db };

