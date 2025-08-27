/* Proprietary and confidential. See LICENSE. */
// src/utils/rowAccess.js

/** Return row.data or row.doc or row itself (whichever holds the fields). */
export function base(row) {
  if (!row || typeof row !== "object") return row;
  if (row.data && typeof row.data === "object") return row.data;
  if (row.doc && typeof row.doc === "object") return row.doc;
  return row;
}

/** Safely get a field from row or nested data/doc. */
export function getField(row, key) {
  if (!row) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  const b = base(row);
  if (b && Object.prototype.hasOwnProperty.call(b, key)) return b[key];
  return undefined;
}

/** Read Firestore Timestamp seconds (null-safe). */
export function getTsSec(v) {
  return v && typeof v === "object" && typeof v.seconds === "number" ? v.seconds : -1;
}

/** Legacy claimed helpers */
export function getClaimedBy(row) {
  const v = getField(row, "claimedBy");
  return v != null ? v : getField(row, "ClaimedBy");
}
export function getClaimedAt(row) {
  const v = getField(row, "claimedAt");
  return v != null ? v : getField(row, "ClaimedAt");
}
