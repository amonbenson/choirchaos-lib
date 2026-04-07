import { type Measure } from "@/model/measure";
import { type Numbering } from "@/music";

import type CompiledBeat from "./beat";
import { type MeasureCompilerState } from "./compilerState";
import type Cut from "./cut";
import { SongStructureError } from "./errors";
import type Marker from "./marker";
import type Repeat from "./repeat";

export default class CompiledMeasure {
  constructor(
    public readonly index: number,
    public readonly number: Numbering,
    public readonly sourceMeasure: Measure,
    public readonly beats: CompiledBeat[],

    public readonly time: number,
    public readonly duration: number,

    public readonly compilerState: MeasureCompilerState,

    public readonly marker?: Marker,
    public readonly repeat?: Repeat,
    public readonly cut?: Cut,
  ) {
    if (index < 0) {
      throw new SongStructureError(`Invalid index: ${index}`);
    }

    if (beats.length === 0) {
      throw new SongStructureError("Measure must contain at least one beat.", index);
    }

    if (duration <= 0) {
      throw new SongStructureError(`Measure cannot have a negative duration. This is likely a tempo change issue.`, index);
    }
  }

  firstBeat(): CompiledBeat {
    return this.beats[0];
  }
};
