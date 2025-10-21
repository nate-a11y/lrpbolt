import { Timestamp } from "firebase/firestore";

import dayjs from "@/utils/dayjsSetup.js";
import logError from "@/utils/logError.js";

function isTimestampLike(value) {
  return (
    value instanceof Timestamp ||
    (value && typeof value === "object" && typeof value.toDate === "function")
  );
}

function toDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (isTimestampLike(value)) {
    try {
      const resolved = value.toDate();
      return Number.isNaN(resolved?.getTime?.()) ? null : resolved;
    } catch (error) {
      logError(error, {
        where: "services.q.toDateSafe",
        phase: "toDate",
      });
      return null;
    }
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }
  if (typeof value === "string") {
    const parsed = dayjs(value);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.toDate();
  }
  if (typeof value?.isValid === "function") {
    try {
      if (!value.isValid()) return null;
      return value.toDate();
    } catch (error) {
      logError(error, {
        where: "services.q.toDateSafe",
        phase: "dayjsLike",
      });
      return null;
    }
  }
  return null;
}

/**
 * Coerce supported values (Dayjs, Date, Timestamp, number, string) to a Firestore Timestamp.
 * Returns null when the input cannot be converted.
 */
export function toTs(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;

  const date = toDateSafe(value);
  if (!date) return null;
  try {
    return Timestamp.fromDate(date);
  } catch (error) {
    logError(error, {
      where: "services.q.toTs",
      valueType: typeof value,
    });
    return null;
  }
}

/**
 * Build a Firestore-friendly range from arbitrary inputs.
 * @param {any} start
 * @param {any} end
 * @param {object} [options]
 * @param {boolean} [options.inclusiveEnd=false] When true, adds 1ms to the end timestamp so callers can emulate <=.
 */
export function buildRange(start, end, { inclusiveEnd = false } = {}) {
  const startTs = toTs(start);
  let endTs = toTs(end);

  if (inclusiveEnd && endTs) {
    try {
      const bumped = Timestamp.fromMillis(endTs.toMillis() + 1);
      endTs = bumped;
    } catch (error) {
      logError(error, {
        where: "services.q.buildRange",
        phase: "inclusiveEnd",
      });
    }
  }

  return { startTs, endTs };
}

/**
 * Wrap a Firestore promise and log rich context before rethrowing.
 */
export async function safeGet(promise, context = {}) {
  try {
    return await promise;
  } catch (error) {
    logError(error, {
      where: "services.q.safeGet",
      ...context,
    });
    throw error;
  }
}

export default {
  toTs,
  buildRange,
  safeGet,
};
