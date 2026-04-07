import { type Beat } from "@/model/beat";
import { type Tempo, type TimeSignature } from "@/music";

import { SongStructureError } from "./errors";
import { type Jump } from "./jump";
import { type MeasureBeatIndex, validateMeasureBeatIndex } from "./measureBeatIndex";

export default class CompiledBeat {
  constructor(
    public readonly index: MeasureBeatIndex,
    public readonly sourceBeat: Beat,

    public readonly time: number,
    public readonly duration: number,

    public readonly tempo: Tempo,
    public readonly timeSignature: TimeSignature,

    public readonly jumps: Jump[],
  ) {
    validateMeasureBeatIndex(index);

    if (duration <= 0) {
      throw new SongStructureError(`Beat cannot have a negative duration. This is likely a tempo change issue.`, index.measure, index.beat);
    }
  }
};
