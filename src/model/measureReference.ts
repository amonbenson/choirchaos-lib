import { asNumbering } from "@/music";

import { type MeasureNumber } from "./measure";

export type MeasureReference = [MeasureNumber, number];

export function asMeasureReference([measure, beat]: [unknown, unknown]): MeasureReference {
  return [asNumbering(measure) as MeasureNumber, Number(beat)];
}
