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
import AppError from "../utils/AppError.js";
import logError from "../utils/logError.js";
import retry from "../utils/retry.js";

import { mapSnapshotToRows } from "./normalizers";

export async function getRides(collectionName) {
  try {
    return await retry(
      async () => {
        const q = query(
          collection(db, collectionName),
          orderBy("pickupTime", "asc"),
        );
        const snap = await getDocs(q);
        return mapSnapshotToRows(collectionName, snap);
      },
      {
        onError: (err, attempt) =>
          logError(err, {
            where: "firestoreService",
            action: `getRides:${collectionName}`,
            attempt,
          }),
      },
    );
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(err.message || "getRides failed", "FIRESTORE_GET", {
            collectionName,
          });
    logError(appErr, { where: "firestoreService", action: "getRides" });
    throw appErr;
  }
}

export function subscribeRides(collectionName, callback, onError) {
  try {
    const q = query(
      collection(db, collectionName),
      orderBy("pickupTime", "asc"),
    );
    return onSnapshot(
      q,
      (snap) => callback(mapSnapshotToRows(collectionName, snap)),
      (err) => {
        const appErr =
          err instanceof AppError
            ? err
            : new AppError(
                err.message || "subscribeRides error",
                "FIRESTORE_SUB",
                {
                  collectionName,
                },
              );
        logError(appErr, {
          where: "firestoreService",
          action: `subscribeRides:${collectionName}`,
        });
        onError?.(appErr);
      },
    );
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(
            err.message || "subscribeRides init failed",
            "FIRESTORE_SUB",
            {
              collectionName,
            },
          );
    logError(appErr, {
      where: "firestoreService",
      action: `subscribeRidesInit:${collectionName}`,
    });
    onError?.(appErr);
    return () => {};
  }
}

export async function updateRide(collectionName, docId, data) {
  const ref = doc(db, collectionName, docId);
  try {
    await retry(
      async () => {
        const snap = await getDoc(ref);
        const payload = { ...data, updatedAt: serverTimestamp() };
        if (!snap.exists()) {
          await setDoc(
            ref,
            { ...payload, createdAt: serverTimestamp() },
            { merge: true },
          );
        } else {
          await setDoc(ref, payload, { merge: true });
        }
      },
      {
        tries: 3,
        onError: (err, attempt) =>
          logError(err, {
            where: "firestoreService",
            action: `updateRide:${collectionName}/${docId}`,
            attempt,
          }),
      },
    );
    return { success: true };
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(err.message || "updateRide failed", "FIRESTORE_UPDATE", {
            collectionName,
            docId,
          });
    logError(appErr, {
      where: "firestoreService",
      action: `updateRide:${collectionName}/${docId}`,
    });
    throw appErr;
  }
}

export async function deleteRide(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(err.message || "deleteRide failed", "FIRESTORE_DELETE", {
            collectionName,
            docId,
          });
    logError(appErr, {
      where: "firestoreService",
      action: `deleteRide:${collectionName}/${docId}`,
    });
    throw appErr;
  }
}
