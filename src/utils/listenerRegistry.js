// src/utils/listenerRegistry.js
// Simple registry to share Firebase listeners across components.
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { auth } from "../firebase";

// Manage shared auth listener
const authCallbacks = new Set();
let authUnsubscribe = null;
let currentUser = null;

export function subscribeAuth(callback) {
  authCallbacks.add(callback);
  if (currentUser !== null) callback(currentUser);
  if (!authUnsubscribe) {
    authUnsubscribe = onAuthStateChanged(auth, (user) => {
      currentUser = user;
      authCallbacks.forEach((cb) => cb(user));
    });
  }
  return () => {
    authCallbacks.delete(callback);
    if (!authCallbacks.size && authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
      currentUser = null;
    }
  };
}

// Generic Firestore snapshot registry keyed by a unique string.
const fsRegistry = new Map();

export function subscribeFirestore(key, queryRef, callback) {
  let entry = fsRegistry.get(key);
  if (!entry) {
    const callbacks = new Set([callback]);
    entry = { callbacks, unsubscribe: null, snapshot: null };
    entry.unsubscribe = onSnapshot(queryRef, (snapshot) => {
      entry.snapshot = snapshot;
      callbacks.forEach((cb) => cb(snapshot));
    });
    fsRegistry.set(key, entry);
  } else {
    entry.callbacks.add(callback);
    if (entry.snapshot) callback(entry.snapshot);
  }
  return () => {
    const current = fsRegistry.get(key);
    if (!current) return;
    current.callbacks.delete(callback);
    if (!current.callbacks.size) {
      current.unsubscribe();
      fsRegistry.delete(key);
    }
  };
}

// Remove all active listeners. Useful on global sign-out to ensure
// no dangling network connections remain.
export function unsubscribeAll() {
  // Auth listener
  authCallbacks.clear();
  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }
  currentUser = null;

  // Firestore listeners
  fsRegistry.forEach(({ unsubscribe }) => unsubscribe());
  fsRegistry.clear();
}

// Backward compatibility for older imports
export const clearAllListeners = unsubscribeAll;
