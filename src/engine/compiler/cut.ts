import { type CutDirection } from "@/model/direction";

import { type CutJump } from "./jump";

export default class Cut {
  constructor(
    public readonly inMeasureIndex: number,
    public readonly outMeasureIndex: number,
    public readonly sourceDirection: CutDirection,
  ) {}

  createJump(cutIndex: number): CutJump {
    return {
      type: "cut",
      targetIndex: { measure: this.outMeasureIndex, beat: 0 },
      cutIndex,
    };
  }
};
