import { Branded } from "@/utils/brand";

import { compareNumberings, type Numbering } from "../music/numbering";
import { Beat } from "./beat";

export type MeasureNumber = Branded<Numbering, "MeasureNumber">;

export type Measure = {
  number: MeasureNumber;
  beats: Beat[];
};

export function compareMeasures(a: Measure, b: Measure): number {
  return compareNumberings(a.number, b.number);
}
