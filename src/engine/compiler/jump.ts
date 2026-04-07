import { type MeasureBeatIndex } from "./measureBeatIndex";

export default class Jump {
  constructor(
    public readonly targetIndex: MeasureBeatIndex,
  ) {}
};
