/* FIX: use unified Firebase app; avoid duplicate-app */
import {
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

import { db } from "@/services/firebase.js";

import { AppError } from "./errors";

export function getDb() {
  if (db) return db;
  throw new AppError("Failed to init Firestore", {
    code: "firestore_init",
  });
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
