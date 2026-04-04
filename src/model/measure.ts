import { type Branded } from "@/utils/brand";

import { type Numbering } from "../music/numbering";
import { type Beat } from "./beat";
import { type MeasureDirection } from "./direction";

export type MeasureNumber = Branded<Numbering, "MeasureNumber">;

export type Measure = {
  beats: Beat[];
  directions: MeasureDirection[];
};
