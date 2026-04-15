import { type Beat } from "@/model/beat";
import { type BeatDirection, type MeasureDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { createSong, type Song } from "@/model/song";
import { type SongId } from "@/model/song";

export function beat(...directions: BeatDirection[]): Beat {
  return { directions };
}

export function measure(beats: Beat[], ...directions: MeasureDirection[]): Measure {
  return { beats, directions };
}

export function song(...measures: Measure[]): Song {
  return { ...createSong("test" as SongId), measures };
}

export function beats(n: number): Beat[] {
  return Array.from({ length: n }, () => beat());
}
