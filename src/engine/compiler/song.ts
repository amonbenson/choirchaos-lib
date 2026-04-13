import { type Song } from "@/model/song";
import { BinarySortedList } from "@/utils/binarySearch";

import type CompiledBeat from "./beat";
import type Cut from "./cut";
import { SongStructureError } from "./errors";
import type Marker from "./marker";
import type CompiledMeasure from "./measure";
import type Repeat from "./repeat";

class BeatIndex extends BinarySortedList<CompiledBeat> {
  constructor(items: CompiledBeat[] = []) {
    super(items, {
      comparator: (a, b) => a.time - b.time,
    });
  }
}

export default class CompiledSong {
  public readonly beatIndex: BeatIndex;

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

    this.beatIndex = new BeatIndex(measures.flatMap(measure => measure.beats));
  }

  get stopMeasure(): CompiledMeasure {
    return this.measures[this.measures.length - 1];
  }

  get duration(): number {
    return this.stopMeasure.time;
  }
}
