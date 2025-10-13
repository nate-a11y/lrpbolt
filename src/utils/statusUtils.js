/* Proprietary and confidential. See LICENSE. */
export const normalizeStatus = (s) => {
  const v = String(s ?? "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  if (v === "queued" || v === "queue") return "open";
  if (v === "cancelled") return "canceled";
  return v;
};

export const boolFromAny = (v) => {
  if (v === true || v === false) return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "y"].includes(s)) return true;
    if (["false", "no", "n", ""].includes(s)) return false;
  }
  return Boolean(v);
};

export const liveOpenPatch = (FieldValue) => ({
  status: "open",
  claimed: false,
  claimedBy: null,
  updatedAt: FieldValue.serverTimestamp(),
  droppedAt: FieldValue.serverTimestamp(),
});
