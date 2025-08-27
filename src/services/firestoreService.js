// src/services/firestoreService.js
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../utils/firebaseInit";
import { logError } from "../utils/logError";
import { mapSnapshotToRows } from "./normalizers";

export async function getRides(collectionName) {
  try {
    const q = query(collection(db, collectionName), orderBy("pickupTime", "asc"));
    const snap = await getDocs(q);
    return mapSnapshotToRows(collectionName, snap);
  } catch (err) {
    logError(err, `getRides:${collectionName}`);
    return [];
  }
}

export function subscribeRides(collectionName, callback, onError) {
  try {
    const q = query(collection(db, collectionName), orderBy("pickupTime", "asc"));
    return onSnapshot(
      q,
      (snap) => callback(mapSnapshotToRows(collectionName, snap)),
      (err) => {
        logError(err, `subscribeRides:${collectionName}`);
        onError?.(err);
      },
    );
  } catch (err) {
    logError(err, `subscribeRidesInit:${collectionName}`);
    onError?.(err);
    return () => {};
  }
}

export async function updateRide(collectionName, docId, data) {
  const ref = doc(db, collectionName, docId);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const snap = await getDoc(ref);
      const payload = { ...data, updatedAt: serverTimestamp() };
      if (!snap.exists()) {
        console.warn(
          `updateRide: ${collectionName}/${docId} does not exist. Creating new document.`,
        );
        await setDoc(
          ref,
          { ...payload, createdAt: serverTimestamp() },
          { merge: true },
        );
      } else {
        await setDoc(ref, payload, { merge: true });
      }
      return { success: true };
    } catch (err) {
      if (attempt === 3) {
        logError(err, `updateRide:${collectionName}/${docId}`);
        throw err;
      }
    }
  }
  return { success: false };
}

export async function deleteRide(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (err) {
    logError(err, `deleteRide:${collectionName}/${docId}`);
    throw err;
  }
}

