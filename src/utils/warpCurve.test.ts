import { describe, expect, it } from "vitest";

import { benchmark } from "@/test/utils";

import WarpCurve from "./warpCurve";

describe("WarpCurve", () => {
  it("warps without any warp points", () => {
    // Straight 45 deg line (unity function)
    const curve = new WarpCurve();

    expect(curve.warp(12.3)).toBeCloseTo(12.3);
    expect(curve.warp(0)).toBeCloseTo(0);
    expect(curve.warp(-23.4)).toBeCloseTo(-23.4);
  });

  it("warps with a single warp point at x=0", () => {
    // Straight 45 deg line with b=5
    const curve = new WarpCurve([{ x: 0, y: 5 }]);

    expect(curve.warp(0)).toBeCloseTo(5);
    expect(curve.warp(1)).toBeCloseTo(6);
    expect(curve.warp(-3.3)).toBeCloseTo(1.7);
    expect(curve.warp(-6)).toBeCloseTo(-1);
  });

  it("warps with a single warp point at an arbitrary position", () => {
    // Straight 45 deg line with b=7
    const curve = new WarpCurve([{ x: -2, y: 5 }]);

    expect(curve.warp(0)).toBeCloseTo(7);
    expect(curve.warp(-1)).toBeCloseTo(6);
  });

  it("warps with two warp points", () => {
    // Straight line through the origin with m=2
    const curve = new WarpCurve([
      { x: 1, y: 2 },
      { x: 3, y: 6 },
    ]);

    expect(curve.warp(0)).toBeCloseTo(0);
    expect(curve.warp(1)).toBeCloseTo(2);
    expect(curve.warp(2)).toBeCloseTo(4);
    expect(curve.warp(3)).toBeCloseTo(6);
    expect(curve.warp(4)).toBeCloseTo(8);
    expect(curve.warp(-3)).toBeCloseTo(-6);
  });

  it("warps with multiple wrap points", () => {
    const curve = new WarpCurve([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 4, y: 5 },
    ]);

    expect(curve.warp(-1)).toBeCloseTo(-2);
    expect(curve.warp(0)).toBeCloseTo(0);
    expect(curve.warp(1.5)).toBeCloseTo(3);
    expect(curve.warp(3)).toBeCloseTo(4.5);
    expect(curve.warp(5)).toBeCloseTo(5.5);
  });

  it("orders warp points", () => {
    const curve = new WarpCurve([
      { x: 1, y: 2 },
      { x: 3, y: 6 },
      { x: 2, y: 4 },
    ]);

    expect(curve.warp(1.5)).toBeCloseTo(3);
    expect(curve.warp(2.5)).toBeCloseTo(5);
  });

  it("throws if warp points overlap", () => {
    expect(() => {
      new WarpCurve([
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 2, y: 6 },
      ]);
    }).toThrow();
  });

  it("warps ranges", () => {
    const curve = new WarpCurve([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 4, y: 5 },
    ]);

    expect(curve.warpRange(1.5, 3)).toEqual([
      expect.closeTo(3),
      expect.closeTo(4.5),
    ]);
  });

  it("uses caching to speed up consecutive range warps", () => {
    const testPoints = Array(100).fill(undefined).map((_, x) => ({
      x,
      y: x + 0.5 * Math.sin(x / (20 * Math.PI)),
    }));
    const curve1 = new WarpCurve(testPoints);
    const curve2 = new WarpCurve(testPoints);

    // Calculate ranges with and without caching
    const runtimeWithCaching = benchmark(() => {
      for (let i = 0; i < 100; i++) {
        const x1 = i - 0.5;
        const x2 = i + 0.5;
        const [_y1, _y2] = curve1.warpRange(x1, x2);
      }
    });

    const runtimeWithoutCaching = benchmark(() => {
      for (let i = 0; i < 100; i++) {
        const x1 = i - 0.5;
        const x2 = i + 0.5;
        const _y1 = curve2.warp(x1);
        const _y2 = curve2.warp(x2);
      }
    });

    expect(runtimeWithCaching).toBeLessThan(runtimeWithoutCaching);
  });
});
