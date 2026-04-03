import type { JsonSerializable, JsonSerializableConstructor } from "../../utils/json.js";
import type { TimeSignature } from "../../utils/timeSignature.js";
import { asMeasureReference, type MeasureReference } from "../measure.js";
import { Direction, type DirectionJson } from "./base.js";

export type TimeSignatureChangeJson = DirectionJson & {
  type: "timeSignatureChange";
  value: TimeSignature;
};

export class TimeSignatureChange extends Direction implements JsonSerializable<TimeSignatureChange, TimeSignatureChangeJson> {
  constructor(
    public measure: MeasureReference,
    public value: TimeSignature,
  ) {
    super(measure);
  }

  public json(): TimeSignatureChangeJson {
    return {
      type: "timeSignatureChange",
      ...this,
    };
  }

  public static fromJson({ measure, value }: TimeSignatureChangeJson): TimeSignatureChange {
    return new TimeSignatureChange(asMeasureReference(measure), value);
  }
}

const _: JsonSerializableConstructor<TimeSignatureChange, TimeSignatureChangeJson> = TimeSignatureChange;
