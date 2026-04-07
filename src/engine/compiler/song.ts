import { type Song } from "@/model/song";

import type Cut from "./cut";
import { SongStructureError } from "./errors";
import type Marker from "./marker";
import type CompiledMeasure from "./measure";
import type Repeat from "./repeat";

export default class CompiledSong {
  constructor(
    public readonly sourceSong: Song,
    public readonly measures: CompiledMeasure[],
    public readonly markers: Marker[],
    public readonly cuts: Cut[],
    public readonly repeats: Repeat[],
  ) {
    if (measures.length === 0) {
      throw new SongStructureError("Song should contain at least a stop measure.");
    }
  }

  get stopMeasure(): CompiledMeasure {
    return this.measures[this.measures.length - 1];
  }

  get duration(): number {
    return this.stopMeasure.time;
  }
}
