/* Proprietary and confidential. See LICENSE. */
export const TIMECLOCK_SCHEMA_CANDIDATES = {
  collections: ["timeLogs", "timeclock", "clockSessions", "shootoutStats"],
  userFields: ["userId", "uid", "driverId", "driverUID", "driverUid"],
  emailFields: ["email", "driverEmail", "userEmail"],
  startFields: ["startTime", "start", "clockIn", "startedAt", "createdAt"],
  endFields: ["endTime", "end", "clockOut", "stoppedAt", "endedAt"],
  activeFlags: ["active", "isActive", "open"],
};

const LS_KEY = "lrp_timeclock_schema_detected_v2"; // bump version to invalidate old bad caches
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function loadDetectedSchema() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire old
    if (parsed?.ttl && Date.now() > parsed.ttl) return null;
    return parsed;
  } catch (e) {
    console.error("[timeclockSchema] load failed", e);
    return null;
  }
}

export function saveDetectedSchema(schema) {
  try {
    // Only persist high-confidence mappings
    if (!schema || schema.confidence !== "high") return;
    const ttl = Date.now() + (schema.ttlMs || DEFAULT_TTL_MS);
    localStorage.setItem(LS_KEY, JSON.stringify({ ...schema, ttl }));
  } catch (e) {
    console.error("[timeclockSchema] save failed", e);
  }
}

export function clearDetectedSchema() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch (e) {
    console.error("[timeclockSchema] clear failed", e);
  }
}

export function pickField(obj, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, k))
      return { key: k, value: obj[k] };
  }
  return { key: null, value: null };
}
