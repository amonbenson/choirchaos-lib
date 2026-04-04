import { describe, expect, it } from "vitest";

import { asNumbering, compareNumberings, type Numbering } from "./numbering";

// Shorthand for constructing valid Numbering values in tests
function n(value: string): Numbering {
  return asNumbering(value);
}

// Bypass branding to test runtime behaviour with invalid inputs
function invalid(value: string): Numbering {
  return value as unknown as Numbering;
}

describe("compareMeasures", () => {
  it("returns 0 for equal measures", () => {
    expect(compareNumberings(n("1"), n("1"))).toBe(0);
    expect(compareNumberings(n("2a"), n("2a"))).toBe(0);
    expect(compareNumberings(n("10b"), n("10b"))).toBe(0);
  });

  it("compares numeric parts", () => {
    expect(compareNumberings(n("1"), n("2"))).toBeLessThan(0);
    expect(compareNumberings(n("3"), n("2"))).toBeGreaterThan(0);
    expect(compareNumberings(n("10a"), n("11a"))).toBeLessThan(0);
    expect(compareNumberings(n("12b"), n("11b"))).toBeGreaterThan(0);
  });

  it("compares letter parts when numbers are equal", () => {
    expect(compareNumberings(n("5a"), n("5b"))).toBeLessThan(0);
    expect(compareNumberings(n("5b"), n("5a"))).toBeGreaterThan(0);
    expect(compareNumberings(n("5"), n("5a"))).toBeLessThan(0);
    expect(compareNumberings(n("5a"), n("5"))).toBeGreaterThan(0);
    expect(compareNumberings(n("7"), n("7"))).toBe(0);
    expect(compareNumberings(n("7a"), n("7a"))).toBe(0);
  });

  it("handles empty or missing letter part", () => {
    expect(compareNumberings(n("8"), n("8a"))).toBeLessThan(0);
    expect(compareNumberings(n("8a"), n("8"))).toBeGreaterThan(0);
    expect(compareNumberings(n("9"), n("9"))).toBe(0);
  });

  it("throws an error for invalid measures", () => {
    expect(() => compareNumberings(invalid("foo"), invalid("bar"))).toThrow(TypeError);
    expect(() => compareNumberings(n("1"), invalid("bar"))).toThrow(TypeError);
    expect(() => compareNumberings(invalid("foo"), n("1"))).toThrow(TypeError);
    expect(() => compareNumberings(invalid(""), invalid(""))).toThrow(TypeError);
    expect(() => compareNumberings(invalid("1#"), n("1"))).toThrow(TypeError);
  });

  it("handles multi-digit numbers", () => {
    expect(compareNumberings(n("10"), n("2"))).toBeGreaterThan(0);
    expect(compareNumberings(n("2"), n("10"))).toBeLessThan(0);
    expect(compareNumberings(n("10a"), n("10b"))).toBeLessThan(0);
    expect(compareNumberings(n("10b"), n("10a"))).toBeGreaterThan(0);
  });

  it("handles iteration suffixes for measures", () => {
    expect(compareNumberings(n("10a-2"), n("10a-1"))).toBeGreaterThan(0);
    expect(compareNumberings(n("10a-1"), n("10a"))).toBeGreaterThan(0);
    expect(compareNumberings(n("11a-1"), n("11b"))).toBeGreaterThan(0);
  });
});
