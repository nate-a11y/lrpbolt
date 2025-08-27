/* Proprietary and confidential. See LICENSE. */
import { describe, expect, it } from "vitest";
import dayjs from "dayjs";

import {
  toDayjs,
  formatDateTime,
  minutesBetween,
  fmtMinutesHuman,
} from "../../src/utils/timeUtils.js";

describe("timeUtils", () => {
  it("toDayjs returns null for invalid", () => {
    expect(toDayjs("bad")).toBeNull();
  });

  it("formatDateTime outputs formatted string", () => {
    const d = new Date("2024-01-01T12:00:00Z");
    expect(formatDateTime(d, "MM/DD/YYYY")).toBe("01/01/2024");
  });

  it("minutesBetween calculates minutes", () => {
    const s = new Date("2024-01-01T00:00:00Z");
    const e = new Date("2024-01-01T01:30:00Z");
    expect(minutesBetween(s, e)).toBe(90);
  });

  it("fmtMinutesHuman formats duration", () => {
    expect(fmtMinutesHuman(125)).toBe("2h 5m");
  });

  it("toDayjs handles seconds/nanoseconds object", () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    const d = toDayjs(ts);
    expect(d?.isValid()).toBe(true);
    expect(dayjs.isDayjs(d)).toBe(true);
  });
});

