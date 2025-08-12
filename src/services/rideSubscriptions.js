/* Proprietary and confidential. See LICENSE. */
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

import { db } from "../utils/firebaseInit";

// Dev-time visibility & attach counters (no-op in prod builds)
const DEBUG = import.meta.env.DEV;
let attachCount = 0;
let detachCount = 0;

/**
 * Subscribe to rides with a stable, single Firestore listener.
 * @param {object} params
 * @param {string=} params.vehicleId
 * @param {string=} params.status              // e.g., "live" | "queue" | "claimed" | etc.
 * @param {{start?:Date|Timestamp,end?:Date|Timestamp}=} params.range
 * @param {number=} params.pageSize
 * @param {(docs: Array<object>) => void} onChange
 * @param {(error: Error) => void=} onError
 * @returns {() => void} unsubscribe
 */
export function subscribeRides(params, onChange, onError) {
  const {
    vehicleId = "",
    status = "",
    range = {},
    pageSize = 500,
  } = params || {};

  const base = collection(db, "rides");
  const clauses = [];

  if (vehicleId) clauses.push(where("vehicleId", "==", vehicleId));
  if (status) clauses.push(where("status", "==", status));

  if (range?.start instanceof Date || range?.start?.toDate) {
    const startTs = range.start?.toDate ? range.start : Timestamp.fromDate(range.start);
    clauses.push(where("pickupTime", ">=", startTs));
  }
  if (range?.end instanceof Date || range?.end?.toDate) {
    const endTs = range.end?.toDate ? range.end : Timestamp.fromDate(range.end);
    clauses.push(where("pickupTime", "<=", endTs));
  }

  clauses.push(orderBy("pickupTime", "asc"));
  clauses.push(limit(pageSize));

  const q = query(base, ...clauses);

  // Attach listener
  const unsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      onChange(rows);
    },
    (err) => {
      if (onError) onError(err);
      if (DEBUG) console.warn("[rides] snapshot error", err);
    }
  );

    if (DEBUG) {
      attachCount += 1;
      console.log(`[rides] onSnapshot ATTACH #${attachCount} (active=${attachCount - detachCount})`);
    }

  return () => {
    unsubscribe();
    if (DEBUG) {
      detachCount += 1;
      console.log(`[rides] onSnapshot DETACH #${detachCount} (active=${attachCount - detachCount})`);
    }
  };
}
