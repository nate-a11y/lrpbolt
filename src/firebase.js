/* Proprietary and confidential. See LICENSE. */
// src/firebase.js

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
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
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

const provider = new GoogleAuthProvider();

export const loginWithPopup = () => signInWithPopup(auth, provider);
export const loginWithRedirect = () => signInWithRedirect(auth, provider);
export const logout = () => signOut(auth);

// ✅ Firestore & Functions setup
export const db = getFirestore(app); // 👈 ADD THIS
export const functions = getFunctions(app);

// 🔑 Export helpers
export { formatAuthError };
