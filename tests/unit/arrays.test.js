import { describe, it, expect } from "vitest";

import { asArray } from "../../src/utils/arrays.js";

describe("asArray", () => {
  it("should return empty array for null or undefined", () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
  });

  it("should return the same array if input is already an array", () => {
    const arr = [1, 2, 3];
    expect(asArray(arr)).toBe(arr);
    expect(asArray(arr)).toEqual([1, 2, 3]);
  });

  it("should convert array-like objects to arrays", () => {
    const arrayLike = { 0: "a", 1: "b", 2: "c", length: 3 };
    expect(asArray(arrayLike)).toEqual(["a", "b", "c"]);
  });

  it("should convert strings to character arrays", () => {
    expect(asArray("hello")).toEqual(["h", "e", "l", "l", "o"]);
    expect(asArray("")).toEqual([]);
  });

  it("should convert Sets to arrays", () => {
    const set = new Set([1, 2, 3]);
    expect(asArray(set)).toEqual([1, 2, 3]);
  });

  it("should convert Maps to arrays of entries", () => {
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    expect(asArray(map)).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("should handle NodeList", () => {
    // Simulate NodeList-like structure
    const nodeList = {
      0: { tagName: "div" },
      1: { tagName: "span" },
      length: 2,
      [Symbol.iterator]: function* () {
        yield this[0];
        yield this[1];
      },
    };
    expect(asArray(nodeList)).toHaveLength(2);
  });

  it("should return empty array for non-iterable objects", () => {
    expect(asArray({})).toEqual([]);
    expect(asArray({ foo: "bar" })).toEqual([]);
  });

  it("should return empty array for primitives that are not iterable", () => {
    expect(asArray(123)).toEqual([]);
    expect(asArray(true)).toEqual([]);
    expect(asArray(false)).toEqual([]);
  });

  it("should handle empty arrays", () => {
    expect(asArray([])).toEqual([]);
  });

  it("should handle typed arrays", () => {
    const uint8 = new Uint8Array([1, 2, 3]);
    expect(asArray(uint8)).toEqual([1, 2, 3]);
  });

  it("should handle generator functions", () => {
    function* generator() {
      yield 1;
      yield 2;
      yield 3;
    }
    expect(asArray(generator())).toEqual([1, 2, 3]);
  });

  it("should preserve array contents", () => {
    const complex = [{ id: 1 }, { id: 2 }, null, undefined, "string"];
    expect(asArray(complex)).toEqual(complex);
  });
});
