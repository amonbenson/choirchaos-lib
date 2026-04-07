import { type Beat } from "@/model/beat";
import { type Tempo, type TimeSignature } from "@/music";

import { SongStructureError } from "./errors";
import Jump from "./jump";
import { type MeasureBeatIndex, validateMeasureBeatIndex } from "./measureBeatIndex";

export default class CompiledBeat {
  constructor(
    public readonly index: MeasureBeatIndex,
    public readonly sourceBeat: Beat,

    public readonly time: number,
    public readonly duration: number,

    public readonly tempo: Tempo,
    public readonly timeSignature: TimeSignature,

    public jump?: Jump,
  ) {
    validateMeasureBeatIndex(index);

    if (duration <= 0) {
      throw new SongStructureError(`Invalid duration: ${duration}`, index.measure, index.beat);
    }
  }

  public withJump(targetIndex: MeasureBeatIndex): this {
    this.jump = new Jump(targetIndex);
    return this;
  }
};
