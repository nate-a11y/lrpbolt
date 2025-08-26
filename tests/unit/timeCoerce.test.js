import { describe, it, expect } from "vitest";

import { tsToDate as coerce } from "../../src/utils/timeCoerce.js";
import { tsToDate as safe } from "../../src/utils/timeUtilsSafe.js";

describe("tsToDate helpers", () => {
  it("handles numeric seconds", () => {
    const sec = 1700000000; // ~2023-11-14T20:53:20Z
    const d1 = coerce(sec);
    const d2 = safe(sec);
    expect(d1?.getUTCFullYear()).toBeGreaterThan(2020);
    expect(d2?.getUTCFullYear()).toBeGreaterThan(2020);
  });
});
