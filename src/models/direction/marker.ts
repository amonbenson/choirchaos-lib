import type { JsonSerializable, JsonSerializableConstructor } from "../../utils/json.js";
import { asMeasureReference, type MeasureReference } from "../measure.js";
import { Direction, type DirectionJson } from "./base.js";

export type MarkerJson = DirectionJson & {
  type: "marker";
  text: string;
};

export class Marker extends Direction implements JsonSerializable<Marker, MarkerJson> {
  constructor(
    public measure: MeasureReference,
    public text: string,
  ) {
    super(measure);
  }

  public json(): MarkerJson {
    return {
      type: "marker",
      ...this,
    };
  }

  public static fromJson({ measure, text }: MarkerJson): Marker {
    return new Marker(asMeasureReference(measure), text);
  }
}

const _: JsonSerializableConstructor<Marker, MarkerJson> = Marker;
