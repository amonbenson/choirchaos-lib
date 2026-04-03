import type { Numbering } from "../utils/numbering.js";
import { MeasureList } from "./measure.js";

const BrandTypeId: unique symbol = Symbol.for("effect/Brand");

export type SongId = string & { readonly [BrandTypeId]: { readonly SongId: "SongId" } };
export type SongNumber = Numbering & { readonly [BrandTypeId]: { readonly SongNumber: "SongNumber" } };

export default class Song {
  constructor(
    public readonly id: SongId,
    public number: SongNumber,
    public title: string,
    public measures: MeasureList = new MeasureList(),
    public events: SongEvents = {
      markers: new MeasureEventList<MarkerEvent>(),
      repeats: new MeasureEventList<RepeatEvent>(),
      jumps: new MeasureEventList<JumpEvent>(),
      segue: false,
    },
  ) {}
}
