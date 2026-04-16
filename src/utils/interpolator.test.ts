import { describe, expect, it } from "vitest";

import { benchmark } from "@/test/utils";

import Interpolator from "./interpolator";

describe("Interpolator", () => {
  it("interpolates without any keypoints", () => {
    // Straight 45 deg line (unity function)
    const i = new Interpolator();

    expect(i.interpolate(12.3)).toBeCloseTo(12.3);
    expect(i.interpolate(0)).toBeCloseTo(0);
    expect(i.interpolate(-23.4)).toBeCloseTo(-23.4);
  });

  it("interpolates a single keypoint at x=0", () => {
    // Straight 45 deg line with b=5
    const i = new Interpolator([{ x: 0, y: 5 }]);

    expect(i.interpolate(0)).toBeCloseTo(5);
    expect(i.interpolate(1)).toBeCloseTo(6);
    expect(i.interpolate(-3.3)).toBeCloseTo(1.7);
    expect(i.interpolate(-6)).toBeCloseTo(-1);
  });

  it("interpolates a single keypoint at an arbitrary position", () => {
    // Straight 45 deg line with b=7
    const i = new Interpolator([{ x: -2, y: 5 }]);

    expect(i.interpolate(0)).toBeCloseTo(7);
    expect(i.interpolate(-1)).toBeCloseTo(6);
  });

  it("interpolates two keypoints", () => {
    // Straight line through the origin with m=2
    const i = new Interpolator([
      { x: 1, y: 2 },
      { x: 3, y: 6 },
    ]);

    expect(i.interpolate(0)).toBeCloseTo(0);
    expect(i.interpolate(1)).toBeCloseTo(2);
    expect(i.interpolate(2)).toBeCloseTo(4);
    expect(i.interpolate(3)).toBeCloseTo(6);
    expect(i.interpolate(4)).toBeCloseTo(8);
    expect(i.interpolate(-3)).toBeCloseTo(-6);
  });

  it("interpolates multiple keypoints", () => {
    const i = new Interpolator([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 4, y: 5 },
    ]);

    expect(i.interpolate(-1)).toBeCloseTo(-2);
    expect(i.interpolate(0)).toBeCloseTo(0);
    expect(i.interpolate(1.5)).toBeCloseTo(3);
    expect(i.interpolate(3)).toBeCloseTo(4.5);
    expect(i.interpolate(5)).toBeCloseTo(5.5);
  });

  it("orders keypoints", () => {
    const i = new Interpolator([
      { x: 1, y: 2 },
      { x: 3, y: 6 },
      { x: 2, y: 4 },
    ]);

    expect(i.interpolate(1.5)).toBeCloseTo(3);
    expect(i.interpolate(2.5)).toBeCloseTo(5);
  });

  it("throws if keypoints ar overlapping", () => {
    expect(() => {
      new Interpolator([
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 2, y: 6 },
      ]);
    }).toThrow();
  });

  it("interpolates ranges", () => {
    const i = new Interpolator([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 4, y: 5 },
    ]);

    expect(i.interpolateRange(1.5, 3)).toEqual([
      expect.closeTo(3),
      expect.closeTo(4.5),
    ]);
  });

  it("uses caching to speed up consecutive range interpolations", () => {
    const testPoints = Array(100).fill(undefined).map((_, x) => ({
      x,
      y: x + 0.5 * Math.sin(x / (20 * Math.PI)),
    }));
    const inter1 = new Interpolator(testPoints);
    const inter2 = new Interpolator(testPoints);

    // Calculate ranges with and without caching
    const runtimeWithCaching = benchmark(() => {
      for (let i = 0; i < 100; i++) {
        const x1 = i - 0.5;
        const x2 = i + 0.5;
        const [_y1, _y2] = inter1.interpolateRange(x1, x2);
      }
    });

    const runtimeWithoutCaching = benchmark(() => {
      for (let i = 0; i < 100; i++) {
        const x1 = i - 0.5;
        const x2 = i + 0.5;
        const _y1 = inter2.interpolate(x1);
        const _y2 = inter2.interpolate(x2);
      }
    });

    expect(runtimeWithCaching).toBeLessThan(runtimeWithoutCaching);
  });
});
