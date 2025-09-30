/* Proprietary and confidential. See LICENSE. */

export const START_KEYS = [
  "startTime",
  "clockIn",
  "startedAt",
  "start_ts",
  "start",
  "clockStartedAt",
];

export const END_KEYS = [
  "endTime",
  "clockOut",
  "endedAt",
  "stop_ts",
  "end",
  "clockStoppedAt",
];

export const UID_KEYS = [
  "userId",
  "uid",
  "driverUid",
  "driverId",
  "ownerId",
  "createdBy",
];

export const EMAIL_KEYS = [
  "email",
  "driverEmail",
  "userEmail",
  "createdByEmail",
];

export function pickFirst(obj, keys = []) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
}

export function isRowActive(row) {
  const status = String(row?.status || "")
    .trim()
    .toLowerCase();
  const statusActive =
    status === "active" || status === "running" || status === "open";
  const hasNoEnd = END_KEYS.every((k) => row?.[k] == null);
  return statusActive || hasNoEnd;
}

export function isActiveRow(row) {
  return isRowActive(row);
}

export function belongsToUser(row, { uidLc, emailLc } = {}) {
  const ru = (pickFirst(row, UID_KEYS) ?? "").toString().trim().toLowerCase();
  const re = (pickFirst(row, EMAIL_KEYS) ?? "").toString().trim().toLowerCase();
  return (uidLc && ru === uidLc) || (emailLc && re === emailLc);
}
