// Proprietary and confidential.
import { Timestamp } from "firebase/firestore";

import { toDayjs } from "@/utils/time";

export const tsToDate = (ts) => {
  try {
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    const d = toDayjs(ts);
    return d ? d.toDate() : null;
  } catch {
    return null;
  }
};

export const dateToTs = (d) => {
  try {
    if (!d) return null;
    if (d instanceof Date) return Timestamp.fromDate(d);
    const n = Number(d);
    if (!Number.isNaN(n)) return Timestamp.fromDate(new Date(n));
    return Timestamp.fromDate(new Date(d));
  } catch {
    return null;
  }
};
