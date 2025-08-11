// src/hooks/firestore.js
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../utils/logError";

// Realtime listener for timeLogs collection
export function subscribeTimeLogs(onData, onError) {
  const q = query(collection(db, "timeLogs"), orderBy("loggedAt", "desc"));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      onData(data);
    },
    (e) => {
      logError(e, { area: "FirestoreSubscribe", comp: "subscribeTimeLogs" });
      onError?.(e);
    },
  );
  return () => unsub();
}

// Realtime listener for shootoutStats collection
export function subscribeShootoutStats(onData, onError) {
  const q = query(collection(db, "shootoutStats"), orderBy("createdAt", "desc"));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      onData(data);
    },
    (e) => {
      logError(e, { area: "FirestoreSubscribe", comp: "subscribeShootoutStats" });
      onError?.(e);
    },
  );
  return () => unsub();
}
