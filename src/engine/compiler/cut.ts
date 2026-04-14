import { type CutDirection } from "@/model/direction";

import { type CutJump } from "./jump";

export default class Cut {
  constructor(
    public readonly inFrameIndex: number,
    public readonly outFrameIndex: number,
    public readonly sourceDirection: CutDirection,
  ) {}

  createJump(cutIndex: number): CutJump {
    return {
      type: "cut",
      targetFrameIndex: this.outFrameIndex,
      cutIndex,
    };
  }
};
