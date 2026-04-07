import { type RepeatDirection } from "@/model/direction";

export default class Repeat {
  constructor(
    public readonly inMeasureIndex: number,
    public readonly outMeasureIndex: number,
    public readonly sourceDirection: RepeatDirection,
  ) {}
};
