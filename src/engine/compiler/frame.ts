import { isNumbering, type Numbering, type Tempo, type TimeSignature } from "@/music";
import { BinarySortedList } from "@/utils/binarySearch";

import type Cut from "./cut";
import { CompilerStateError, SongStructureError } from "./errors";
import { type Jump } from "./jump";
import type Marker from "./marker";
import type Repeat from "./repeat";

export default class Frame {
  constructor(
    public readonly index: number,
    public readonly measureIndex: number,
    public readonly beatIndex: number,

    public readonly measureNumber: Numbering,
    public readonly measureFrameIndex: number,
    public readonly measureBeats: number,

    public readonly time: number,
    public readonly duration: number,

    public readonly tempo: Tempo,
    public readonly timeSignature: TimeSignature,

    public marker?: Marker,
    public cut?: Cut,
    public repeat?: Repeat,
    public jumps: Jump[] = [],
  ) {
    if (index < 0) {
      throw new CompilerStateError(`Invalid frame index: ${index}`);
    }

    if (measureIndex < 0) {
      throw new SongStructureError(`Invalid measure index: ${measureIndex}`);
    }

    if (measureBeats < 1) {
      throw new SongStructureError(`Measure must contain at least one beat: ${measureBeats}`);
    }

    if (beatIndex < 0 || beatIndex >= measureBeats) {
      throw new SongStructureError(`Invalid beat index: ${beatIndex}`);
    }

    if (!isNumbering(measureNumber)) {
      throw new SongStructureError(`Invalid measure number: ${measureNumber}`);
    }

    if (duration <= 0) {
      throw new SongStructureError(`Beat cannot have a negative duration. This is likely a tempo change issue.`, measureIndex, beatIndex);
    }
  }
};
