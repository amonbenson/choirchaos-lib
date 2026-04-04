import { asNumbering, compareNumberings } from "@/music";

import { type MeasureNumber } from "./measure";

export type MeasureReference = [MeasureNumber, number];

export function asMeasureReference([measure, beat]: [unknown, unknown]): MeasureReference {
  return [asNumbering(measure) as MeasureNumber, Number(beat)];
}

export function compareMeasureReferences(a: MeasureReference, b: MeasureReference): number {
  const nrDiff = compareNumberings(a[0], b[0]);
  if (nrDiff !== 0) {
    // Compare by measure numbers
    return nrDiff;
  } else {
    // Compare by beats
    return a[1] - b[1];
  }
}
