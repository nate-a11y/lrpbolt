/* Proprietary and confidential. See LICENSE. */
import { describe, expect, it } from "vitest";

import { toDate, fmtDateTime, minutesBetween, minutesToHMM } from "../../src/utils/timeUtils.js";

describe("timeUtils", () => {
  it("toDate returns null for invalid", () => {
    expect(toDate("bad")).toBeNull();
  });

  it("fmtDateTime outputs formatted string", () => {
    const d = new Date("2024-01-01T12:00:00Z");
    expect(fmtDateTime(d, undefined, "MM/DD/YYYY")).toBe("01/01/2024");
  });

  it("minutesBetween calculates minutes", () => {
    const s = new Date("2024-01-01T00:00:00Z");
    const e = new Date("2024-01-01T01:30:00Z");
    expect(minutesBetween(s, e)).toBe(90);
  });

  it("minutesToHMM formats duration", () => {
    expect(minutesToHMM(125)).toBe("2h 5m");
  });

  it("toDate handles seconds/nanoseconds object", () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    const d = toDate(ts);
    expect(d instanceof Date).toBe(true);
  });
});

