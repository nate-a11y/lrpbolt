// src/utils/listenerRegistry.js
// Simple registry to share Firebase listeners across components.
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { auth } from "../firebase";

// Manage shared auth listener
const authCallbacks = new Set();
let authUnsubscribe = null;

export function subscribeAuth(callback) {
  authCallbacks.add(callback);
  if (!authUnsubscribe) {
    authUnsubscribe = onAuthStateChanged(auth, (user) => {
      authCallbacks.forEach((cb) => cb(user));
    });
  }
  return () => {
    authCallbacks.delete(callback);
    if (!authCallbacks.size && authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
    }
  };
}

// Generic Firestore snapshot registry keyed by a unique string.
const fsRegistry = new Map();

export function subscribeFirestore(key, queryRef, callback) {
  let entry = fsRegistry.get(key);
  if (!entry) {
    const callbacks = new Set([callback]);
    const unsubscribe = onSnapshot(queryRef, (snapshot) => {
      callbacks.forEach((cb) => cb(snapshot));
    });
    entry = { callbacks, unsubscribe };
    fsRegistry.set(key, entry);
  } else {
    entry.callbacks.add(callback);
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
