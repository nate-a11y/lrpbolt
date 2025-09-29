/* Proprietary and confidential. See LICENSE. */
export const TIMECLOCK_SCHEMA_CANDIDATES = {
  collections: ["timeLogs", "timeclock", "clockSessions", "shootoutStats"],
  userFields: ["userId", "uid", "driverId", "driverUID", "driverUid"],
  emailFields: ["email", "driverEmail", "userEmail"],
  startFields: ["startTime", "start", "clockIn", "startedAt", "createdAt"],
  endFields: ["endTime", "end", "clockOut", "stoppedAt", "endedAt"],
  activeFlags: ["active", "isActive", "open"],
};

const LS_KEY = "lrp_timeclock_schema_detected_v1";

export function loadDetectedSchema() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("[timeclockSchema] load failed", e);
    return null;
  }
}

export function saveDetectedSchema(schema) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(schema));
  } catch (e) {
    console.error("[timeclockSchema] save failed", e);
  }
}

export function pickField(obj, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, k))
      return { key: k, value: obj[k] };
  }
  return { key: null, value: null };
}
