/* Proprietary and confidential. See LICENSE. */
import { describe, expect, it } from "vitest";

import {
  toDayjs,
  formatTime,
  formatDate,
  formatDuration,
} from "../../src/utils/timeUtils.js";

describe("timeUtils", () => {
  it("toDayjs returns null for invalid", () => {
    expect(toDayjs("bad")).toBeNull();
  });

  it("formatTime formats and rounds when requested", () => {
    const d = new Date("2024-01-01T12:03:00");
    expect(formatTime(d)).toBeTruthy();
    expect(formatTime(d, { round: true, step: 5 })).toContain("05");
  });

  it("formatDate outputs string", () => {
    const d = new Date("2024-01-01T12:00:00Z");
    expect(formatDate(d)).toBe("01/01/2024");
  });

  it("formatDuration computes hours and minutes", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T02:15:00Z");
    expect(formatDuration(start, end)).toBe("2h 15m");
  });

  it("toDayjs handles seconds/nanoseconds object", () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    const d = toDayjs(ts);
    expect(d?.isValid()).toBe(true);
  });
});

