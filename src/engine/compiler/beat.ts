import { type Tempo, type TimeSignature } from "@/music";

import type Jump from "./jump";
import type CompiledMeasure from "./measure";

export default class CompiledBeat {
  constructor(
    public readonly measure: CompiledMeasure,
    public readonly beatIndex: number,

    public readonly time: number,
    public readonly duration: number,

    public readonly tempo: Tempo,
    public readonly timeSignature: TimeSignature,

    public jump?: Jump,
  ) {}

  withJump(jump: Jump): this {
    this.jump = jump;
    return this;
  }
};
