import type CompiledMeasure from "./measure";

export default class Marker {
  constructor(
    public readonly measure: CompiledMeasure,
    public readonly value: string,
  ) {}
}
