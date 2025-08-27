/* Proprietary and confidential. See LICENSE. */
import { describe, expect, it } from "vitest";

import { formatDateTime, durationMinutes, safeNumber } from "../../src/utils/timeUtils.js";

describe("timeUtils", () => {
  it("formatDateTime outputs formatted string", () => {
    const d = new Date("2024-01-01T12:00:00Z");
    expect(formatDateTime(d, "MM/DD/YYYY")).toBe("01/01/2024");
  });

  it("formatDateTime handles Firestore timestamp", () => {
    const ts = { toDate: () => new Date("2023-01-01T00:00:00Z") };
    expect(formatDateTime(ts)).not.toBe("N/A");
  });

  it("durationMinutes calculates minutes", () => {
    const s = new Date("2024-01-01T00:00:00Z");
    const e = new Date("2024-01-01T01:30:00Z");
    expect(durationMinutes(s, e)).toBe(90);
  });

  it("safeNumber returns fallback for invalid", () => {
    expect(safeNumber("foo", "N/A")).toBe("N/A");
    expect(safeNumber(5)).toBe(5);
  });
});
