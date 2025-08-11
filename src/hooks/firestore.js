// src/hooks/firestore.js
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

// Realtime listener for timeLogs collection
export function subscribeTimeLogs(callback) {
  const q = query(collection(db, "timeLogs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
}

// Realtime listener for shootoutStats collection
export function subscribeShootoutStats(callback) {
  const q = query(collection(db, "shootoutStats"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
}
