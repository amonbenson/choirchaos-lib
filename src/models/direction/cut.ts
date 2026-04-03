import type { JsonSerializable, JsonSerializableConstructor } from "../../utils/json.js";
import { asMeasureReference, type MeasureReference } from "../measure.js";
import { Direction, type DirectionJson } from "./base.js";

export type CutJson = DirectionJson & {
  type: "cut";
  end: MeasureReference;
  iterations: number;
};

export class Cut extends Direction implements JsonSerializable<Cut, CutJson> {
  constructor(
    public measure: MeasureReference,
    public end: MeasureReference,
    public iterations: number = 2,
  ) {
    super(measure);
  }

  public json(): CutJson {
    return {
      type: "cut",
      ...this,
    };
  }

  public static fromJson({ measure, end, iterations }: CutJson): Cut {
    return new Cut(asMeasureReference(measure), asMeasureReference(end), iterations);
  }
}

const _: JsonSerializableConstructor<Cut, CutJson> = Cut;
