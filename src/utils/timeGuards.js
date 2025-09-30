/* Proprietary and confidential. See LICENSE. */
export function pickFirst(obj, keys = []) {
  for (const key of keys) {
    if (obj && obj[key] != null) return obj[key];
  }
  return undefined;
}

export function isActiveRow(row) {
  const status = String(row?.status || "").toLowerCase();
  const hasActiveStatus =
    status === "active" || status === "running" || status === "open";
  const noEnd =
    row?.endTime == null && row?.clockOut == null && row?.endedAt == null;
  return hasActiveStatus || noEnd;
}

export const START_KEYS = [
  "startTime",
  "clockIn",
  "startedAt",
  "start_ts",
  "start",
  "clockStartedAt",
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
