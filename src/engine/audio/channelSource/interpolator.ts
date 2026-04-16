import { BinarySortedList } from "@/utils/binarySearch";

export type Keypoint = {
  x: number;
  y: number;
};

export type Keyframe = {
  x: number;
  m: number;
  b: number;
};

export default class Interpolator {
  private keypoints: BinarySortedList<Keypoint>;
  private keyframes: BinarySortedList<Keyframe>;
  private rangeCache?: Keypoint;

  constructor(keypoints: Keypoint[] = []) {
    this.keypoints = new BinarySortedList<Keypoint>(keypoints, { comparator: (a, b) => a.x - b.x });
    this.keyframes = new BinarySortedList<Keyframe>([], { comparator: (a, b) => a.x - b.x });
    this.update();
  }

  update(): void {
    this.keyframes.clear();

    if (this.keypoints.length === 0) {
      // If no keypoints were provided, assume a unity function (y = x)
      this.keyframes.insert({ x: 0, m: 1, b: 0 });
    } else if (this.keypoints.length === 1) {
      // If only one keypoint was provided, assume a y-shift (m = 1)
      const p = this.keypoints.at(0)!;
      this.keyframes.insert({ x: 0, m: 1, b: p.y - p.x });
    } else {
      // Calculate the linear function for each keypoint pair
      for (let i = 0; i < this.keypoints.length - 1; i++) {
        const pa = this.keypoints.at(i)!;
        const pb = this.keypoints.at(i + 1)!;

        if (Math.abs(pa.x - pb.x) < Number.EPSILON) {
          throw new Error("Duplicate keypoints.");
        }

        // Create linear equation from points A and B
        const m = (pb.y - pa.y) / (pb.x - pa.x);
        const b = pa.y - m * pa.x;
        this.keyframes.insert({ x: pa.x, m, b });
      }
    }

    // Invalidate the cache
    this.rangeCache = undefined;
  }

  interpolate(x: number): number {
    // Get nearest keyframe via binary search
    const { m, b } = this.keyframes.search({ x }, {
      direction: "backward",
      inclusive: true,
      extend: true,
    })!;

    // Plug x into the linear equation
    return m * x + b;
  }

  interpolateRange(ax: number, bx: number): [number, number] {
    // Check if the range's lower bound is cached
    let ay;
    if (this.rangeCache && Math.abs(ax - this.rangeCache.x) < Number.EPSILON) {
      ay = this.rangeCache.y;
    } else {
      ay = this.interpolate(ax);
    }

    // Interpolate by and store it as cache
    const by = this.interpolate(bx);
    this.rangeCache = { x: bx, y: by };

    return [ay, by];
  }
}
