import { BinarySortedList } from "@/utils/binarySearch";

export type WarpPoint = {
  x: number;
  y: number;
};

export type WarpSegment = {
  x: number;
  m: number;
  b: number;
};

export default class WarpCurve {
  private points: BinarySortedList<WarpPoint>;
  private segments: BinarySortedList<WarpSegment>;
  private rangeCache?: WarpPoint;

  constructor(points: WarpPoint[] = []) {
    this.points = new BinarySortedList<WarpPoint>(points, { comparator: (a, b) => a.x - b.x });
    this.segments = new BinarySortedList<WarpSegment>([], { comparator: (a, b) => a.x - b.x });

    // Initial build
    this.build();
  }

  build(): void {
    this.segments.clear();

    if (this.points.length === 0) {
      // If no warp points were provided, assume a unity function (y = x)
      this.segments.insert({ x: 0, m: 1, b: 0 });
    } else if (this.points.length === 1) {
      // If only one warp point was provided, assume a y-shift (m = 1)
      const p = this.points.at(0)!;
      this.segments.insert({ x: 0, m: 1, b: p.y - p.x });
    } else {
      // Calculate the linear function for each pair of points
      for (let i = 0; i < this.points.length - 1; i++) {
        const pa = this.points.at(i)!;
        const pb = this.points.at(i + 1)!;

        if (Math.abs(pa.x - pb.x) < Number.EPSILON) {
          throw new Error(`Duplicate warp points at x=${pa.x}.`);
        }

        // Create linear equation from points A and B
        const m = (pb.y - pa.y) / (pb.x - pa.x);
        const b = pa.y - m * pa.x;
        this.segments.insert({ x: pa.x, m, b });
      }
    }

    // Invalidate the cache
    this.rangeCache = undefined;
  }

  warp(x: number): number {
    // Get nearest segment via binary search
    const { m, b } = this.segments.search({ x }, {
      direction: "backward",
      inclusive: true,
      extend: true,
    })!;

    // Plug x into the linear equation
    return m * x + b;
  }

  warpRange(ax: number, bx: number): [number, number] {
    // Lookup the lower bounds from cache
    let ay;
    if (this.rangeCache && Math.abs(ax - this.rangeCache.x) < Number.EPSILON) {
      ay = this.rangeCache.y;
    } else {
      ay = this.warp(ax);
    }

    // Interpolate point b and store it as cache
    const by = this.warp(bx);
    this.rangeCache = { x: bx, y: by };

    return [ay, by];
  }
}
