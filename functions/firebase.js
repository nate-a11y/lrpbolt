/* Proprietary and confidential. See LICENSE. */
// Centralized Firebase Admin initialization for Cloud Functions

import admin from "firebase-admin";

const app = admin.apps.length ? admin.app() : admin.initializeApp();

// Access Firestore through the initialized app
const db = admin.firestore();

export { admin, app, db };

