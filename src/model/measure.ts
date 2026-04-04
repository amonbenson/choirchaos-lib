import { Branded } from "@/utils/brand";

import { type Numbering } from "../music/numbering";
import { Beat } from "./beat";

export type MeasureNumber = Branded<Numbering, "MeasureNumber">;

export type Measure = {
  beats: Beat[];
};
