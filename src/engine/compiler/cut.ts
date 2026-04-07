import { type CutDirection } from "@/model/direction";

export default class Cut {
  constructor(
    public readonly inMeasureIndex: number,
    public readonly outMeasureIndex: number,
    public readonly sourceDirection: CutDirection,
  ) {}
};
