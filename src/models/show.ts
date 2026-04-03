import type { UrlOrFile } from "../utils/file.js";
import { compareNumberings } from "../utils/numbering.js";
import type Song from "./song.js";

const BrandTypeId: unique symbol = Symbol.for("effect/Brand");

type ShowId = string & { readonly [BrandTypeId]: { readonly ShowId: "ShowId" } };

export default class Show {
  constructor(
    public readonly id: ShowId,
    public title: string,
    public thumbnail?: UrlOrFile,
    public songs: Song[] = [],
  ) {
    this.songs.sort((a, b) => compareNumberings(a.number, b.number));
  }
}
