import { type Beat } from "./beat";
import { type MeasureDirection } from "./direction";

export type Measure = {
  beats: Beat[];
  directions: MeasureDirection[];
};
