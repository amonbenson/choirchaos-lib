import { type Branded } from "@/utils/brand";
import { type UrlOrFile } from "@/utils/file";

import { type Song } from "./song";

export type ShowId = Branded<string, "ShowId">;

export type Show = {
  readonly id: string;
  title: string;
  thumbnail?: UrlOrFile;
  songs: Song[];
};

export function createShow(id: ShowId, title: string = "", thumbnail?: UrlOrFile): Show {
  return {
    id,
    title,
    thumbnail,
    songs: [],
  };
}
