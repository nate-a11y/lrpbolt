/* Proprietary and confidential. See LICENSE. */
// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // 👈 ADD THIS
import { getFunctions } from "firebase/functions";
import { formatAuthError } from "./utils/errorUtils";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    (typeof window !== "undefined" ? window.location.hostname : undefined),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// 🔌 Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Auth setup
const auth = getAuth(app);

// ✅ Firestore & Functions setup
export const db = getFirestore(app); // 👈 ADD THIS
export const functions = getFunctions(app);

// 🔑 Export auth + helpers
export { auth, onAuthStateChanged, signOut, formatAuthError };
