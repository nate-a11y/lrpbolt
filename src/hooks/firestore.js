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

// Fetch a simple 7-day summary of timeLogs grouped by driver
export async function fetchWeeklySummary({ days = 7 } = {}) {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const q = query(
      collection(db, "timeLogs"),
      where("loggedAt", ">=", Timestamp.fromDate(since)),
      orderBy("loggedAt", "desc")
    );

    const snap = await getDocs(q);
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const toDate = (v) => {
      if (!v) return null;
      if (typeof v.toDate === "function") return v.toDate();
      if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
      if (v instanceof Date) return v;
      return null;
    };

    const byDriver = new Map();

    for (const r of rows) {
      const driverRaw = r.driverEmail || r.driver || "Unknown";
      const driver = typeof driverRaw === "string" ? driverRaw.toLowerCase() : String(driverRaw);

      let minutes = 0;
      if (typeof r.duration === "number" && r.duration >= 0) {
        minutes = Math.round(r.duration);
      } else {
        const start = toDate(r.start);
        const end = toDate(r.end);
        if (start && end) minutes = Math.round((end - start) / 60000);
      }

      const prev = byDriver.get(driver) || 0;
      byDriver.set(driver, prev + minutes);
    }

    return Array.from(byDriver.entries()).map(([driver, minutes]) => ({
      driver,
      minutes,
    }));
  } catch (e) {
    logError(e, { area: "FirestoreFetch", comp: "fetchWeeklySummary" });
    throw e;
  }
}
