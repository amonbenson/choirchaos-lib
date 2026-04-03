import type { JsonSerializable, JsonSerializableConstructor } from "../../utils/json.js";
import { asMeasureReference, type MeasureReference } from "../measure.js";
import { Direction, type DirectionJson } from "./base.js";

export type RepeatJson = DirectionJson & {
  type: "repeat";
  end: MeasureReference;
  iterations: number;
};

export class Repeat extends Direction implements JsonSerializable<Repeat, RepeatJson> {
  constructor(
    public measure: MeasureReference,
    public end: MeasureReference,
    public iterations: number = 2,
  ) {
    super(measure);
  }

  public json(): RepeatJson {
    return {
      type: "repeat",
      ...this,
    };
  }

  public static fromJson({ measure, end, iterations }: RepeatJson): Repeat {
    return new Repeat(asMeasureReference(measure), asMeasureReference(end), iterations);
  }
}

const _: JsonSerializableConstructor<Repeat, RepeatJson> = Repeat;
