import dayjs from "dayjs";

// Convert Firestore Timestamp or string to dayjs safely.
export const safeTsToDayjs = (ts) => {
  if (!ts) return null;
  if (typeof ts === "object" && ts.seconds != null) {
    return dayjs(ts.seconds * 1000);
  }
  return dayjs(ts);
};

// Ensure value is a finite number; otherwise return default.
export const ensureNumber = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Merge object with defaults without mutating.
export const withDefaults = (obj, defaults) => Object.assign({}, defaults, obj || {});

// Normalize a shootout session document.
export const normalizeSession = (raw, fallbackId) => {
  const id = raw?.id ?? fallbackId;
  const data = typeof raw?.data === 'function' ? raw.data() : raw;
  if (!data || typeof data !== 'object') return null;
  const start = safeTsToDayjs(data.startTime);
  const end = safeTsToDayjs(data.endTime);
  return {
    id,
    uid: data.uid ?? null,
    driverName: data.driverName ?? 'Unknown',
    vehicle: data.vehicle ?? '',
    trips: ensureNumber(data.trips),
    passengers: ensureNumber(data.passengers),
    startTime: start?.isValid() ? start : null,
    endTime: end?.isValid() ? end : null,
    createdAt: safeTsToDayjs(data.createdAt),
  };
};
