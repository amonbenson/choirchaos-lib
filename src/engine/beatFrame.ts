import type { CutDirection, MarkerDirection, RepeatDirection } from "@/model/direction";
import type { MeasureReference } from "@/model/measureReference";
import type { Tempo, TimeSignature } from "@/music";
import { BinarySortedList } from "@/utils/binarySearch";

import { type ResolvedDirection } from "./resolvedDirection";

export type BeatFrame = {
  time: number;
  duration: number;
  reference: MeasureReference;

  tempo: Tempo;
  timeSignature: TimeSignature;

  marker?: ResolvedDirection<MarkerDirection>;
  repeat?: ResolvedDirection<RepeatDirection>;
  cut?: ResolvedDirection<CutDirection>;

  isRepeatEnd: boolean;
  isVampExit: boolean;
};

export class BeatTimeline extends BinarySortedList<BeatFrame> {
  constructor(items?: BeatFrame[]) {
    super(items, {
      comparator: (a, b) => a.time - b.time,
    });
  }
}
