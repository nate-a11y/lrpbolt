/* Proprietary and confidential. See LICENSE. */
import { collection, onSnapshot } from "firebase/firestore";

import logError from "../utils/logError.js";

import { db } from "./firebase.js";

// Singleton in-memory store
let currentMap = new Map();
let unsubscribe = null;
const listeners = new Set();

function notify() {
  const snapshot = Object.fromEntries(currentMap.entries());
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (err) {
      logError({ where: "usersService.notify" }, err);
    }
  });
}

export function subscribeUsersMap(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("subscribeUsersMap expects a function");
  }

  callback(Object.fromEntries(currentMap.entries()));

  if (!unsubscribe) {
    unsubscribe = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const next = new Map();
        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const name =
            data.displayName ||
            [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
            data.name ||
            docSnap.id;
          next.set(docSnap.id, name || docSnap.id);
        });
        currentMap = next;
        notify();
      },
      (err) => {
        logError({ where: "usersService.subscribe", collection: "users" }, err);
      },
    );
  }

  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getDisplayName(uid, fallback = null) {
  if (!uid) return fallback || uid || "Unknown";
  return currentMap.get(uid) || fallback || uid || "Unknown";
}
