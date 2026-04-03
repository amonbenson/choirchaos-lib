import type { Numbering } from "../music/numbering.js";
import { DirectionList } from "./direction/base.js";
import { Cut } from "./direction/cut.js";
import { Marker } from "./direction/marker.js";
import { Repeat } from "./direction/repeat.js";
import { Vamp } from "./direction/vamp.js";
import { MeasureList } from "./measure.js";

const BrandTypeId: unique symbol = Symbol.for("effect/Brand");

export type SongId = string & { readonly [BrandTypeId]: { readonly SongId: "SongId" } };
export type SongNumber = Numbering & { readonly [BrandTypeId]: { readonly SongNumber: "SongNumber" } };

export type SongDirections = {
  markers: DirectionList<Marker>;
  repeats: DirectionList<Repeat>;
  vamps: DirectionList<Vamp>;
  cuts: DirectionList<Cut>;
  segue: boolean;
};

export default class Song {
  constructor(
    public readonly id: SongId,
    public number: SongNumber,
    public title: string,
    public measures: MeasureList = new MeasureList(),
    public directions: SongDirections = {
      markers: new DirectionList<Marker>(),
      repeats: new DirectionList<Repeat>(),
      vamps: new DirectionList<Vamp>(),
      cuts: new DirectionList<Cut>(),
      segue: false,
    },
  ) {}
}
