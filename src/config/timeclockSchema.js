/* Proprietary and confidential. See LICENSE. */
export const TIMECLOCK_SCHEMA = {
  collection: "timeLogs", // change here if your collection name differs
  userFields: ["userId", "uid", "driverId", "driverUID"],
  startFields: ["startTime", "start", "clockIn", "startedAt", "createdAt"],
  endFields: ["endTime", "end", "clockOut", "stoppedAt"],
  activeFlags: ["active", "isActive", "open"], // boolean true means open
};
export function pickField(obj, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, k))
      return { key: k, value: obj[k] };
  }
  return { key: null, value: null };
}
