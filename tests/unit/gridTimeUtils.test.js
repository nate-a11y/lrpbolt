import { toDateAny } from "../../src/utils/gridFormatters.js";
import { tsToDate } from "../../src/utils/gridFx.js";

describe("grid time helpers", () => {
  it("converts numeric seconds and milliseconds", () => {
    const sec = 1700000000; // seconds
    const ms = 1700000000000; // milliseconds
    expect(toDateAny(sec)).toEqual(new Date(sec * 1000));
    expect(toDateAny(ms)).toEqual(new Date(ms));
    expect(tsToDate(sec)).toEqual(new Date(sec * 1000));
    expect(tsToDate(ms)).toEqual(new Date(ms));
  });
});
