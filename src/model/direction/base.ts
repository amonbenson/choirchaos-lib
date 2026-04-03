import { BinarySortedList } from "../../utils/binarySearch.js";
import { compareMeasureReferences, type MeasureReference } from "../measure.js";

export type DirectionJson = {
  type: "marker" | "repeat" | "vamp" | "cut" | "tempoChange" | "timeSignatureChange";
  measure: [string, number];
};

export abstract class Direction {
  constructor(
    public measure: MeasureReference,
  ) {}

  public abstract json(): DirectionJson;
}

export class DirectionList<T extends Direction> extends BinarySortedList<T> {
  constructor(items?: T[]) {
    super(items, {
      comparator: (a, b) => compareMeasureReferences(a.measure, b.measure),
    });
  }
}
