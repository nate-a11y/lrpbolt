/* LRP Portal enhancement: Firestore core, 2025-10-03. */
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

import { AppError, logError } from "./errors";

let _app;
let _db;
export function getDb() {
  if (_db) return _db;
  try {
    const cfg = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    };
    _app = _app || initializeApp(cfg);
    _db = getFirestore(_app);
    return _db;
  } catch (e) {
    logError(e, { where: "firestoreCore.getDb" });
    throw new AppError("Failed to init Firestore", {
      code: "firestore_init",
      cause: e,
    });
  }
}

// Re-export most-used Firestore APIs for services files only (not UI)
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
};
