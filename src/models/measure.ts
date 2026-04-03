import { BinarySortedList } from "../utils/binarySearch.js";
import type { JsonSerializable, JsonSerializableConstructor } from "../utils/json.js";
import { asNumbering, compareNumberings, type Numbering } from "../utils/numbering.js";

const BrandTypeId: unique symbol = Symbol.for("effect/Brand");

export type MeasureNumber = Numbering & { readonly [BrandTypeId]: { readonly MeasureNumber: "MeasureNumber" } };
export type BeatNumber = number & { readonly [BrandTypeId]: { readonly BeatNumber: "BeatNumber" } };
export type MeasureReference = [MeasureNumber, BeatNumber];

export function asMeasureReference([measure, beat]: [string, number]): MeasureReference {
  return [asNumbering(measure) as MeasureNumber, beat as BeatNumber];
}

export type MeasureJson = {
  number: string;
  beats: number;
};

export default class Measure implements JsonSerializable<Measure, MeasureJson> {
  constructor(
    public number: MeasureNumber,
    public beats: number,
  ) {}

  public reference(beat: BeatNumber): MeasureReference {
    return [this.number, beat];
  }

  json(): { number: string; beats: number } {
    return {
      number: this.number,
      beats: this.beats,
    };
  }

  public static fromJson({ number, beats }: { number: string; beats: number }): Measure {
    return new Measure(asNumbering(number) as MeasureNumber, beats);
  }
}

const _: JsonSerializableConstructor<Measure, MeasureJson> = Measure;

export function compareMeasureReferences(a: MeasureReference, b: MeasureReference): number {
  const nrDiff = compareNumberings(a[0], b[0]);
  if (nrDiff !== 0) {
    // compare by measure numbers
    return nrDiff;
  } else {
    // compare by beats
    return a[1] - b[1];
  }
}

export function compareMeasures(a: Measure, b: Measure): number {
  return compareNumberings(a.number, b.number);
}

export class MeasureList extends BinarySortedList<Measure> {
  constructor(items?: Measure[]) {
    super(items, {
      comparator: (a, b) => compareMeasures(a, b),
    });
  }
}
