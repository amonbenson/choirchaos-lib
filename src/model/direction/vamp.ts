import type { JsonSerializable, JsonSerializableConstructor } from "../../utils/json.js";
import { asMeasureReference, type MeasureReference } from "../measure.js";
import { Direction, type DirectionJson } from "./base.js";

export type VampExit = { type: "end" }
  | { type: "bar"; every: number }
  | { type: "beat"; every: number };

export type VampJson = DirectionJson & {
  type: "vamp";
  end: MeasureReference;
  exit: VampExit;
  safety: boolean;
};

export class Vamp extends Direction implements JsonSerializable<Vamp, VampJson> {
  constructor(
    public measure: MeasureReference,
    public end: MeasureReference,
    public exit: VampExit = { type: "end" },
    public safety: boolean = false,
  ) {
    super(measure);
  }

  public json(): VampJson {
    return {
      type: "vamp",
      ...this,
    };
  }

  public static fromJson({ measure, end, exit, safety }: VampJson): Vamp {
    return new Vamp(asMeasureReference(measure), asMeasureReference(end), exit, safety);
  }
}

const _: JsonSerializableConstructor<Vamp, VampJson> = Vamp;
