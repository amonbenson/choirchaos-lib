import { type Song } from "@/model/song";

import type CompiledMeasure from "./measure";

export default class CompiledSong {
  constructor(
    public readonly sourceSong: Song,
    public readonly measures: CompiledMeasure[],
  ) {}
}
