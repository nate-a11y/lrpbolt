/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Return [windowStart, windowEnd] day window for a given date in tz.
 * Supports custom operational windows (e.g., 6 -> 27 = 3am next day).
 */
export function getDayWindow(dateInput, tz, opts = {}) {
  const tzName = tz || dayjs.tz.guess();
  const d = dayjs.tz(dateInput, tzName);

  if (opts.startHour != null && opts.endHour != null) {
    const start = d.hour(opts.startHour).minute(0).second(0).millisecond(0);
    const endHour =
      opts.endHour <= opts.startHour ? opts.endHour + 24 : opts.endHour;
    const end = start.add(endHour - opts.startHour, "hour");
    return [start, end];
  }

  const start = d.startOf("day");
  const end = d.endOf("day").add(1, "millisecond"); // exclusive end
  return [start, end];
}

/**
 * Normalize + clamp an event to a window and return left/width percentages.
 * Handles overnight: if end <= start, treat as ending next day.
 */
export function clampSegmentToWindow(
  startTs,
  endTs,
  windowStart,
  windowEnd,
  tz,
) {
  const tzName = tz || dayjs.tz.guess();
  const toD = (v) => {
    if (!v) return null;
    if (v.seconds != null && v.nanoseconds != null) {
      return dayjs.tz(v.seconds * 1000, tzName);
    }
    return dayjs(v).tz(tzName);
  };

  let start = toD(startTs);
  let end = toD(endTs);
  if (!start || !end) {
    return {
      leftPct: 0,
      widthPct: 0,
      isClampedLeft: false,
      isClampedRight: false,
    };
  }
  if (end.isSame(start) || end.isBefore(start)) end = end.add(1, "day");

  const winStart = windowStart;
  const winEnd = windowEnd;

  const clampedStart = start.isBefore(winStart) ? winStart : start;
  const clampedEnd = end.isAfter(winEnd) ? winEnd : end;

  const windowMs = Math.max(winEnd.diff(winStart), 1);
  const leftMs = Math.max(clampedStart.diff(winStart), 0);
  const widthMs = Math.max(clampedEnd.diff(clampedStart), 0);

  const leftPct = Math.max(0, Math.min(100, (leftMs / windowMs) * 100));
  const widthPct = Math.max(
    0,
    Math.min(100 - leftPct, (widthMs / windowMs) * 100),
  );

  return {
    leftPct,
    widthPct,
    isClampedLeft: start.isBefore(winStart),
    isClampedRight: end.isAfter(winEnd),
  };
}

/** Optional “now” indicator position (0..100). */
export function computeNowPct(windowStart, windowEnd, tz) {
  const tzName = tz || dayjs.tz.guess();
  const now = dayjs().tz(tzName);
  const total = Math.max(windowEnd.diff(windowStart), 1);
  const pos = Math.max(0, Math.min(total, now.diff(windowStart)));
  return (pos / total) * 100;
}

export function buildTicks(windowStart, windowEnd, everyMinutes = 60) {
  const ticks = [];
  const totalMin = Math.max(windowEnd.diff(windowStart, "minute"), 1);
  const steps = Math.ceil(totalMin / everyMinutes);
  for (let i = 0; i <= steps; i++) {
    const t = windowStart.add(i * everyMinutes, "minute");
    if (t.isAfter(windowEnd)) break;
    const pct = Math.min(
      100,
      Math.max(0, (t.diff(windowStart, "minute") / totalMin) * 100),
    );
    ticks.push({ t, pct });
  }
  return ticks;
}
