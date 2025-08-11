/* Proprietary and confidential. See LICENSE. */
// tests/unit/timeUtils.test.js
import { describe, it, expect } from "vitest";
import { normalizeTime, setSyncTime, getSyncTime } from "../../src/utils/timeUtils.js";

describe("timeUtils.normalizeTime", () => {
  it("normalizes lowercase am/pm to uppercase", () => {
    expect(normalizeTime("1:05 pm")).toContain("PM");
  });

  it("handles already-correct casing", () => {
    expect(normalizeTime("9:00 AM")).toBeTruthy();
  });
});

describe("timeUtils sync helpers", () => {
  it("sets and retrieves sync time", () => {
    setSyncTime("10:00");
    expect(getSyncTime()).toBe("10:00");
  });
});
