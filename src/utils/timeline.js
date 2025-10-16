/* Proprietary and confidential. See LICENSE. */
import dayjs from "@/utils/dayjsSetup.js";

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

/**
 * Given sorted rides for a vehicle and the day window, produce an array of
 * { kind: "busy"|"free", start, end } segments that fully cover the window.
 * Rides: [{ start: dayjs, end: dayjs }]
 */
export function buildBusyFreeSegments(rides, windowStart, windowEnd) {
  const segs = [];
  let cursor = windowStart;
  const normalized = rides
    .map((r) => {
      let s = r.start;
      let e = r.end;
      if (e.isSame(s) || e.isBefore(s)) e = e.add(1, "day"); // overnight safe
      // clamp to window for segment building
      const cs = s.isBefore(windowStart) ? windowStart : s;
      const ce = e.isAfter(windowEnd) ? windowEnd : e;
      return { s: cs, e: ce, valid: ce.isAfter(cs) };
    })
    .filter((x) => x.valid)
    .sort((a, b) => a.s.valueOf() - b.s.valueOf());

  for (const { s, e } of normalized) {
    if (s.isAfter(cursor)) {
      segs.push({ kind: "free", start: cursor, end: s });
    }
    segs.push({ kind: "busy", start: s, end: e });
    cursor = e.isAfter(cursor) ? e : cursor;
  }

  if (cursor.isBefore(windowEnd)) {
    segs.push({ kind: "free", start: cursor, end: windowEnd });
  }
  return segs;
}

/**
 * Convert a time range to {leftPct, widthPct} inside window.
 */
export function toPctRange(start, end, windowStart, windowEnd) {
  const total = Math.max(windowEnd.diff(windowStart, "minute"), 1);
  const left = Math.max(0, start.diff(windowStart, "minute"));
  const width = Math.max(0, end.diff(start, "minute"));
  const leftPct = Math.max(0, Math.min(100, (left / total) * 100));
  const widthPct = Math.max(0, Math.min(100 - leftPct, (width / total) * 100));
  return { leftPct, widthPct };
}

/**
 * Minutes helper: clamp negative; safe for empty windows.
 */
export function minutesInRange(a, b) {
  return Math.max(0, b.diff(a, "minute"));
}

// Keep a percentage inside [pad .. 100 - pad] to avoid label overflow at edges.
export function clampPct(pct, pad = 1.5) {
  if (Number.isNaN(pct)) return 0;
  return Math.max(pad, Math.min(100 - pad, pct));
}
