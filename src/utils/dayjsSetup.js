/* Proprietary and confidential. See LICENSE. */
import dayjsImport from "dayjs/esm/index.js";
import utc from "dayjs/esm/plugin/utc/index.js";
import timezone from "dayjs/esm/plugin/timezone/index.js";
import isSameOrBefore from "dayjs/esm/plugin/isSameOrBefore/index.js";
import isSameOrAfter from "dayjs/esm/plugin/isSameOrAfter/index.js";
import isBetween from "dayjs/esm/plugin/isBetween/index.js";
import advancedFormat from "dayjs/esm/plugin/advancedFormat/index.js";
import localizedFormat from "dayjs/esm/plugin/localizedFormat/index.js";
import customParseFormat from "dayjs/esm/plugin/customParseFormat/index.js";
import duration from "dayjs/esm/plugin/duration/index.js";
import relativeTime from "dayjs/esm/plugin/relativeTime/index.js";

// Ensure dayjs is defined before setup
const dayjs = dayjsImport;
if (!dayjs) {
  throw new Error("dayjs failed to load");
}

if (!dayjs.__lrpSetupDone) {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(isSameOrBefore);
  dayjs.extend(isSameOrAfter);
  dayjs.extend(isBetween);
  dayjs.extend(advancedFormat);
  dayjs.extend(localizedFormat);
  dayjs.extend(customParseFormat);
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  Object.defineProperty(dayjs, "__lrpSetupDone", {
    value: true,
    writable: false,
  });
}

let defaultTimezone = "UTC";
try {
  if (dayjs.tz) {
    const guess = dayjs.tz.guess();
    if (guess) {
      dayjs.tz.setDefault(guess);
      defaultTimezone = guess;
    }
  }
} catch (error) {
  void error;
}

const coerceTimestamp = (value) => {
  if (!value || typeof value !== "object") return null;
  if (typeof value.toDate === "function") return value.toDate();
  const seconds = Number(value.seconds);
  const nanoseconds = Number(value.nanoseconds);
  if (Number.isFinite(seconds) || Number.isFinite(nanoseconds)) {
    const ms =
      (Number.isFinite(seconds) ? seconds * 1000 : 0) +
      (Number.isFinite(nanoseconds) ? Math.floor(nanoseconds / 1e6) : 0);
    return new Date(ms);
  }
  return null;
};

export const toDayjs = (value, tz) => {
  try {
    if (value === null || value === undefined) return null;

    let instance = null;
    if (dayjs.isDayjs?.(value)) {
      instance = value;
    } else if (value instanceof Date) {
      instance = dayjs(value);
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      instance = dayjs(value);
    } else if (typeof value === "string") {
      instance = dayjs(value);
    } else {
      const coerced = coerceTimestamp(value);
      if (coerced) {
        instance = dayjs(coerced);
      }
    }

    if (!instance || !instance.isValid()) return null;

    const targetTz = tz || defaultTimezone;
    if (typeof instance.tz === "function" && dayjs.tz) {
      try {
        return instance.tz(targetTz);
      } catch (error) {
        void error;
      }
    }
    return instance;
  } catch (error) {
    void error;
    return null;
  }
};

export const isD = (value) => {
  return Boolean(
    value && typeof value.isValid === "function" && value.isValid(),
  );
};

export const getDefaultTimezone = () => defaultTimezone;

export default dayjs;
