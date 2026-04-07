import { type CutDirection, type MarkerDirection } from "@/model/direction";

import Cut from "./cut";
import Jump from "./jump";
import Marker from "./marker";
import type CompiledMeasure from "./measure";
import { CompiledEndMeasure } from "./measure";

export default class CompiledSong {
  constructor(
    public readonly measures: CompiledMeasure[],
  ) {}

  withMarker(measureIndex: number, markerDirection: MarkerDirection): this {
    const measure = this.measures[measureIndex];
    measure.withMarker(new Marker(measure, markerDirection.value));
    return this;
  }

  withCut(measureIndex: number, cut: CutDirection) {
    const inMeasure = this.measures[measureIndex];
    const outMeasure = this.measures[measureIndex + cut.length];

    const cut = new Cut(inMeasure, outMeasure);
    const jump = new Jump(outMeasure.firstBeat());
  }
};
