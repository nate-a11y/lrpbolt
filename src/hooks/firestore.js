// src/hooks/firestore.js
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

import { db } from "src/utils/firebaseInit";

import { logError } from "../utils/logError";
import { nullifyMissing } from "../utils/formatters.js";

// Realtime listener for timeLogs collection
export function subscribeTimeLogs(onData, onError) {
  try {
    const q = query(collection(db, "timeLogs"), orderBy("loggedAt", "desc"));
    return onSnapshot(
      q,
      (snap) =>
        onData(
          snap.docs.map((d) => {
            const data = d.data() || {};
            return { id: d.id, ...nullifyMissing(data) };
          }),
        ),
      (e) => {
        logError(e, { area: "FirestoreSubscribe", comp: "subscribeTimeLogs" });
        onError?.(e);
      },
    );
  } catch (e) {
    logError(e, { area: "FirestoreSubscribe", comp: "subscribeTimeLogs" });
    onError?.(e);
    return () => {};
  }
}

// Realtime listener for shootoutStats collection
export function subscribeShootoutStats(onData, onError) {
  try {
    const q = query(collection(db, "shootoutStats"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) =>
        onData(
          snap.docs.map((d) => {
            const data = d.data() || {};
            return { id: d.id, ...nullifyMissing(data) };
          }),
        ),
      (e) => {
        logError(e, { area: "FirestoreSubscribe", comp: "subscribeShootoutStats" });
        onError?.(e);
      },
    );
  } catch (e) {
    logError(e, { area: "FirestoreSubscribe", comp: "subscribeShootoutStats" });
    onError?.(e);
    return () => {};
  }
}

