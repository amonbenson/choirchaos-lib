import { type Branded } from "@/utils/brand";

import type { Numbering } from "../music/numbering";
import { type SongDirection } from "./direction";
import { type FileContents } from "./fileContents";
import { type Measure } from "./measure";
import { type Track } from "./track";

export type SongId = Branded<string, "SongId">;
export type SongNumber = Branded<Numbering, "SongNumber">;

export type Song = {
  id: SongId;
  number: SongNumber;
  title: string;
  measures: Measure[];
  directions: SongDirection[];
  tracks: Track[];
  files: FileContents[];
};

export function createSong(id: SongId, number: SongNumber = "1" as SongNumber, title: string = ""): Song {
  return {
    id,
    number,
    title,
    measures: [],
    directions: [],
    tracks: [],
    files: [],
  };
}
