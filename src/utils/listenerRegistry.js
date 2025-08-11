// src/utils/listenerRegistry.js
// Simple registry to share Firebase listeners across components.
import { onSnapshot } from "firebase/firestore";

// Generic Firestore snapshot registry keyed by a unique string.
const fsRegistry = new Map();

export function subscribeFirestore(key, queryRef, callback, onError) {
  let entry = fsRegistry.get(key);
  if (!entry) {
    const callbacks = new Map();
    callbacks.set(callback, onError);
    entry = { callbacks, unsubscribe: null, snapshot: null };
    entry.unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        entry.snapshot = snapshot;
        callbacks.forEach((_, cb) => cb(snapshot));
      },
      (err) => {
        callbacks.forEach((errCb) => {
          errCb?.(err);
        });
      },
    );
    fsRegistry.set(key, entry);
  } else {
    entry.callbacks.set(callback, onError);
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
  fsRegistry.forEach(({ unsubscribe }) => unsubscribe());
  fsRegistry.clear();
}

// Backward compatibility for older imports
export const clearAllListeners = unsubscribeAll;
