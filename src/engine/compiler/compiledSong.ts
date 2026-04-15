import { type Song } from "@/model/song";

import type Cut from "./cut";
import { SongStructureError } from "./errors";
import type Frame from "./frame";
import type Marker from "./marker";
import type Repeat from "./repeat";

export default class CompiledSong {
  constructor(
    public readonly source: Song,
    public readonly frames: Frame[],
    public readonly markers: Marker[],
    public readonly cuts: Cut[],
    public readonly repeats: Repeat[],
  ) {
    if (frames.length === 0) {
      throw new SongStructureError("Compiled song must contain at least a stop measure.");
    }
  }

  get stopFrame(): Frame {
    return this.frames[this.frames.length - 1] as Frame;
  }

  get duration(): number {
    return this.stopFrame.time;
  }
}
