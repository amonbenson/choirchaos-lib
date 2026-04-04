import { asNumbering, compareNumberings } from "@/music";

import { BeatNumber } from "./beat";
import { MeasureNumber } from "./measure";

export type MeasureReference = [MeasureNumber, BeatNumber];

export function asMeasureReference([measure, beat]: [unknown, unknown]): MeasureReference {
  return [asNumbering(measure) as MeasureNumber, Number(beat)];
}

export function compareMeasureReferences(a: MeasureReference, b: MeasureReference): number {
  const nrDiff = compareNumberings(a[0], b[0]);
  if (nrDiff !== 0) {
    // compare by measure numbers
    return nrDiff;
  } else {
    // compare by beats
    return a[1] - b[1];
  }
}
