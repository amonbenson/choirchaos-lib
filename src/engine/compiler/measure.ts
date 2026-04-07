import { type Numbering } from "@/music";

import type CompiledBeat from "./beat";
import type Cut from "./cut";
import type Marker from "./marker";
import type Repeat from "./repeat";
import type CompiledSong from "./song";

export default class CompiledMeasure {
  constructor(
    public readonly song: CompiledSong,
    public readonly index: number,
    public readonly label: Numbering,

    public readonly time: number,
    public readonly duration: number,

    public readonly beats: CompiledBeat[],

    public marker?: Marker,
    public cut?: Cut,
    public repeat?: Repeat,
  ) {}

  firstBeat(): CompiledBeat {
    return this.beats[0];
  }

  withMarker(marker: Marker): this {
    this.marker = marker;
    return this;
  }

  withCut(cut: Cut): this {
    this.cut = cut;
    return this;
  }

  withRepeat(repeat: Repeat): this {
    this.repeat = repeat;
    return this;
  }
}

export class CompiledEndMeasure {
  constructor(
    public readonly index: number,

    public readonly time: number,

    public readonly beat: CompiledBeat,
  ) {}

  firstBeat(): CompiledBeat {
    return this.beat;
  }
}

export type CompiledMetaMeasure = CompiledMeasure | CompiledEndMeasure;
