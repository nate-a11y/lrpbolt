/* Proprietary and confidential. See LICENSE. */
import { describe, expect, it } from "vitest";

import { toDayjs, fmtDateTime, fmtMinutes } from "../../src/utils/timeUtils.js";

describe("timeUtils", () => {
  it("toDayjs returns null for invalid", () => {
    expect(toDayjs("bad")).toBeNull();
  });

  it("fmtDateTime outputs formatted string", () => {
    const d = new Date("2024-01-01T12:00:00Z");
    expect(fmtDateTime(d, "MM/DD/YYYY")).toBe("01/01/2024");
  });

  it("fmtMinutes outputs minutes", () => {
    expect(fmtMinutes(125)).toBe("125");
  });

  it("toDayjs handles seconds/nanoseconds object", () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    const d = toDayjs(ts);
    expect(d?.isValid()).toBe(true);
  });
});

