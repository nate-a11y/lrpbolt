// src/hooks/firestore.js
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "src/utils/firebaseInit";

import { logError } from "../utils/logError";
import { normalizeTimeLog, normalizeShootout } from "../utils/normalizeTimeLog";

// Realtime listener for timeLogs collection
export function subscribeTimeLogs(onData, onError) {
  const q = query(collection(db, "timeLogs"), orderBy("createdAt", "desc"));
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
      const data = snapshot.docs.map((doc) =>
        normalizeShootout(doc.id, doc.data() || {}),
      );
      onData(data);
    },
    (e) => {
      logError(e, { area: "FirestoreSubscribe", comp: "subscribeShootoutStats" });
      onError?.(e);
    },
  );
  return () => unsub();
}

// Fetch a simple 7-day summary of timeLogs grouped by driver
export async function fetchWeeklySummary({ days = 7 } = {}) {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const q = query(
      collection(db, "timeLogs"),
      where("startTime", ">=", Timestamp.fromDate(since)),
      orderBy("startTime", "desc"),
    );

    const snap = await getDocs(q);
    const rows = snap.docs.map((doc) =>
      normalizeTimeLog(doc.id, doc.data() || {}),
    );

    const byDriver = new Map();

    for (const r of rows) {
      const driverKey = (r.driverDisplay || "Unknown").toLowerCase();
      const prev =
        byDriver.get(driverKey) || {
          driver: r.driverDisplay || "Unknown",
          totalMinutes: 0,
          entries: 0,
        };
      prev.totalMinutes += r.durationMin || 0;
      prev.entries += 1;
      byDriver.set(driverKey, prev);
    }

    return Array.from(byDriver.values());
  } catch (e) {
    logError(e, { area: "FirestoreFetch", comp: "fetchWeeklySummary" });
    throw e;
  }
}
