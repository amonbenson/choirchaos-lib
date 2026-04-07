import type CompiledMeasure from "./measure";
import { type CompiledMetaMeasure } from "./measure";

export default class Cut {
  constructor(
    public readonly inMeasure: CompiledMeasure,
    public readonly outMeasure: CompiledMetaMeasure,
  ) {}
};
