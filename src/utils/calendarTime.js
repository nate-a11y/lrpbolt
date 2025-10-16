/* Proprietary and confidential. See LICENSE. */
import dayjs, { toDayjs, isD, getDefaultTimezone } from "./dayjsSetup.js";

export const LRP_TZ = getDefaultTimezone() || dayjs.tz?.guess?.() || "UTC";

const cmpLTE = (a, b) => {
  if (!a || !b) return false;
  const da = isD(a) ? a : toDayjs(a);
  const db = isD(b) ? b : toDayjs(b);
  if (!isD(da) || !isD(db)) return false;
  return typeof da.isSameOrBefore === "function"
    ? da.isSameOrBefore(db)
    : da.valueOf() <= db.valueOf();
};

const cmpGTE = (a, b) => {
  if (!a || !b) return false;
  const da = isD(a) ? a : toDayjs(a);
  const db = isD(b) ? b : toDayjs(b);
  if (!isD(da) || !isD(db)) return false;
  return typeof da.isSameOrAfter === "function"
    ? da.isSameOrAfter(db)
    : da.valueOf() >= db.valueOf();
};

export const compareLte = cmpLTE;
export const compareGte = cmpGTE;

export function getDayWindow(selectedDay, tz = LRP_TZ) {
  const base =
    toDayjs(selectedDay, tz) ||
    (typeof dayjs.tz === "function" ? dayjs().tz(tz) : dayjs());
  const dayStart = base.startOf("day");
  const dayEnd = dayStart.add(1, "day");
  return { dayStart, dayEnd, tz };
}

export const clampToWindow = (
  { start, end },
  winStart,
  winEnd,
  tz = LRP_TZ,
) => {
  const s = toDayjs(start, tz);
  const e = toDayjs(end, tz);
  const ws = toDayjs(winStart, tz);
  const we = toDayjs(winEnd, tz);

  if (!isD(s) || !isD(e) || !isD(ws) || !isD(we)) return null;
  if (cmpGTE(s, we) || cmpLTE(e, ws)) return null;

  const clampedStart = cmpGTE(s, ws) ? s : ws;
  const clampedEnd = cmpLTE(e, we) ? e : we;
  if (!cmpLTE(clampedStart, clampedEnd)) return null;

  return {
    start: clampedStart,
    end: clampedEnd,
    windowStart: ws,
    windowEnd: we,
  };
};

export function clampToDay({ start, end }, selectedDay, tz = LRP_TZ) {
  const { dayStart, dayEnd } = getDayWindow(selectedDay, tz);
  const clamped = clampToWindow({ start, end }, dayStart, dayEnd, tz);
  if (!clamped) return null;

  const originalStart = toDayjs(start, tz);
  const originalEnd = toDayjs(end, tz);
  if (!isD(originalStart) || !isD(originalEnd)) return null;

  let reason = null;
  if (cmpLTE(originalStart, dayStart) && cmpGTE(originalEnd, dayStart)) {
    reason = "fromPrevDay";
  }
  if (cmpGTE(originalEnd, dayEnd) && cmpLTE(originalStart, dayEnd)) {
    reason = reason ? "spansBoth" : "intoNextDay";
  }

  return {
    clampedStart: clamped.start,
    clampedEnd: clamped.end,
    reason,
    dayStart,
    dayEnd,
    tz,
  };
}

export const toDayjsSafe = toDayjs;

export function plural(n, singular, pluralWord = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}
