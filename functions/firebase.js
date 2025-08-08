/* Proprietary and confidential. See LICENSE. */
// Centralized Firebase Admin initialization for Cloud Functions

import admin from "firebase-admin";

// Initialize the Firebase admin SDK only once in cold starts
const app = admin.apps.length > 0 ? admin.app() : admin.initializeApp();

// Access Firestore through the initialized app
const db = admin.firestore();

export { admin, app, db };

