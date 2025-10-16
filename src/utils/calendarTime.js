/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const LRP_TZ = dayjs.tz.guess();

/** tz-aware day window for a given date-like (string|Date|dayjs) */
export function getDayWindow(selectedDay, tz = LRP_TZ) {
  const dayStart = dayjs.tz(selectedDay, tz).startOf("day");
  const dayEnd = dayStart.add(1, "day"); // [dayStart, dayEnd)
  return { dayStart, dayEnd };
}

/** Safe convert input to dayjs in tz. Accepts Firestore Timestamp, ms, ISO, Date, dayjs. */
export function toDayjsSafe(input, tz = LRP_TZ) {
  try {
    if (!input) return null;
    if (typeof input?.toMillis === "function")
      return dayjs.tz(input.toMillis(), tz);
    if (typeof input === "number" && Number.isFinite(input))
      return dayjs.tz(input, tz);
    if (dayjs.isDayjs(input))
      return input.tz ? input.tz(tz) : dayjs.tz(input.valueOf(), tz);
    const d = dayjs(input);
    return d.isValid() ? d.tz(tz) : null;
  } catch {
    return null;
  }
}

/**
 * Clamp a [start,end) interval to the selected day.
 * Returns null if no overlap.
 * reason: "fromPrevDay" | "intoNextDay" | "spansBoth" | null
 */
export function clampToDay({ start, end }, selectedDay, tz = LRP_TZ) {
  const s = toDayjsSafe(start, tz);
  const e = toDayjsSafe(end, tz);
  if (!s || !e || !s.isValid() || !e.isValid()) return null;

  const { dayStart, dayEnd } = getDayWindow(selectedDay, tz);

  // If ends <= dayStart or starts >= dayEnd → no visible portion on this day
  if (e.isSameOrBefore(dayStart) || s.isSameOrAfter(dayEnd)) return null;

  const clampedStart = s.isBefore(dayStart) ? dayStart : s;
  const clampedEnd = e.isAfter(dayEnd) ? dayEnd : e;

  let reason = null;
  if (s.isBefore(dayStart) && e.isAfter(dayStart)) reason = "fromPrevDay";
  if (e.isAfter(dayEnd) && s.isBefore(dayEnd))
    reason = reason ? "spansBoth" : "intoNextDay";

  return { clampedStart, clampedEnd, reason, dayStart, dayEnd, tz };
}

/** Simple plural helper: plural(1,"ride") → "1 ride"; plural(2,"ride") → "2 rides" */
export function plural(n, singular, pluralWord = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}
