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
import { diffMinutes } from "../utils/timeUtilsSafe";

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
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const byDriver = new Map();

    for (const r of rows) {
      const driverRaw = r.driverEmail || r.driver || "Unknown";
      const driver = typeof driverRaw === "string" ? driverRaw.toLowerCase() : String(driverRaw);

      let minutes = 0;
      if (typeof r.duration === "number" && r.duration >= 0) {
        minutes = Math.round(r.duration);
      } else {
        const m = diffMinutes(r.startTime, r.endTime);
        minutes = m ?? 0;
      }

      const prev = byDriver.get(driver) || { totalMinutes: 0, entries: 0 };
      prev.totalMinutes += minutes;
      prev.entries += 1;
      byDriver.set(driver, prev);
    }

    return Array.from(byDriver.entries()).map(([driver, v]) => ({
      driver,
      totalMinutes: v.totalMinutes,
      entries: v.entries,
    }));
  } catch (e) {
    logError(e, { area: "FirestoreFetch", comp: "fetchWeeklySummary" });
    throw e;
  }
}
