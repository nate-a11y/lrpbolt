/* FIX: use unified Firebase app; avoid duplicate-app */
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

import { getFirebaseApp } from "./firebaseApp";
import { AppError, logError } from "./errors";

let _db;
export function getDb() {
  if (_db) return _db;
  try {
    const app = getFirebaseApp();
    _db = getFirestore(app);
    return _db;
  } catch (e) {
    logError(e, { where: "firestoreCore.getDb" });
    throw new AppError("Failed to init Firestore", {
      code: "firestore_init",
      cause: e,
    });
  }
}

// re-exports remain unchanged
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
