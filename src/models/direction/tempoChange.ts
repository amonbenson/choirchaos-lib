import type { JsonSerializable, JsonSerializableConstructor } from "../../utils/json.js";
import type { Tempo } from "../../utils/tempo.js";
import { asMeasureReference, type MeasureReference } from "../measure.js";
import { Direction, type DirectionJson } from "./base.js";

export type TempoChangeJson = DirectionJson & {
  type: "tempoChange";
  value: Tempo;
};

export class TempoChange extends Direction implements JsonSerializable<TempoChange, TempoChangeJson> {
  constructor(
    public measure: MeasureReference,
    public value: Tempo,
  ) {
    super(measure);
  }

  public json(): TempoChangeJson {
    return {
      type: "tempoChange",
      ...this,
    };
  }

  public static fromJson({ measure, value }: TempoChangeJson): TempoChange {
    return new TempoChange(asMeasureReference(measure), value);
  }
}

const _: JsonSerializableConstructor<TempoChange, TempoChangeJson> = TempoChange;
