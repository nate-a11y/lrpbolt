import { normalizeTime } from "../../src/timeUtils.js";

describe("timeUtils", () => {
  test("normalizeTime enforces AM/PM format", () => {
    expect(normalizeTime("1:05 pm")).toBe("1:05 PM");
  });
});
