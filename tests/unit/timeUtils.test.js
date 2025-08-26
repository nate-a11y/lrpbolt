/* Proprietary and confidential. See LICENSE. */
import { describe, expect, it } from "vitest";

import {
  toDayjs,
  durationMinutesFloor,
  durationHumanFloor,
  formatLocalShort,
} from "../../src/utils/timeUtils.js";

describe("timeUtils", () => {
  it("toDayjs returns null for invalid", () => {
    expect(toDayjs("bad")).toBeNull();
  });

  it("durationMinutesFloor floors the diff", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T00:59:59Z");
    expect(durationMinutesFloor(start, end)).toBe(59);
  });

  it("durationHumanFloor formats", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T02:15:00Z");
    expect(durationHumanFloor(start, end)).toBe("2h 15m");
  });

  it("formatLocalShort outputs string", () => {
    const d = new Date("2024-01-01T12:00:00Z");
    expect(formatLocalShort(d)).toContain("Jan");
  });

  it("toDayjs handles seconds/nanoseconds object", () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    const d = toDayjs(ts);
    expect(d?.isValid()).toBe(true);
  });

  it("formatLocalShort handles seconds/nanoseconds object", () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    expect(formatLocalShort(ts)).not.toBe("—");
  });
});
