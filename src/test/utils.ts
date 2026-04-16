import { type Beat } from "@/model/beat";
import { type BeatDirection, type MeasureDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { createSong, type Song } from "@/model/song";
import { type SongId } from "@/model/song";

export function benchmark(fn: () => void, runs = 1000): number {
  // Warmup
  for (let i = 0; i < 50; i++) {
    fn();
  }

  // Actual benchmark
  const start = performance.now();

  for (let i = 0; i < runs; i++) {
    fn();
  }

  // Return average duration per run
  return (performance.now() - start) / runs;
}

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
