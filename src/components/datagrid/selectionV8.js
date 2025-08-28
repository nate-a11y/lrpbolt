import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// -------- v8 selection helpers ----------
export function toV8Model(input) {
  if (!input) return { ids: new Set(), type: "include" };
  if (Array.isArray(input)) return { ids: new Set(input), type: "include" };
  if (input instanceof Set) return { ids: input, type: "include" };
  if (typeof input === "object") {
    const rawIds = input.ids;
    let ids;
    if (rawIds instanceof Set) ids = rawIds;
    else if (Array.isArray(rawIds)) ids = new Set(rawIds);
    else if (rawIds && Array.isArray(rawIds.current)) ids = new Set(rawIds.current);
    else if (input.id != null) ids = new Set([input.id]);
    else ids = new Set();
    const type = input.type === "exclude" ? "exclude" : "include";
    return { ids, type };
  }
  return { ids: new Set(), type: "include" };
}

export function selectedCount(model) {
  return model && model.ids instanceof Set ? model.ids.size : 0;
}

// -------- formatting helpers (null-safe, Firestore Timestamp aware) ----------
export function isFsTimestamp(v) {
  // Firestore Timestamp has toDate(); also support {seconds,nanoseconds}
  return !!(
    v &&
    (typeof v.toDate === "function" ||
      (typeof v.seconds === "number" && typeof v.nanoseconds === "number"))
  );
}

export function formatMaybeTs(v, tz = dayjs.tz.guess()) {
  try {
    if (!v) return "N/A";
    if (typeof v.toDate === "function")
      return dayjs(v.toDate()).tz(tz).format("YYYY-MM-DD HH:mm");
    if (typeof v.seconds === "number")
      return dayjs(new Date(v.seconds * 1000)).tz(tz).format("YYYY-MM-DD HH:mm");
    return String(v);
  } catch {
    return String(v ?? "N/A");
  }
}

export function stringifyCell(value) {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (isFsTimestamp(value)) return formatMaybeTs(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
