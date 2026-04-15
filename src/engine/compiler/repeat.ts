import { type RepeatDirection } from "@/model/direction";

import { type RepeatJump, type VampExitJump } from "./jump";

export default class Repeat {
  constructor(
    public readonly inFrameIndex: number,
    public readonly outFrameIndex: number,
    public readonly sourceDirection: RepeatDirection,
  ) {}

  isVampExit(inMeasureIndex: number, measureIndex: number, beatIndex: number): boolean {
    const exit = this.sourceDirection.exit;
    const measuresIntoVamp = measureIndex - inMeasureIndex;

    switch (exit.type) {
      case "count":
        return false;
      case "vamp":
        return beatIndex === 0 && measuresIntoVamp === 0;
      case "vampOutAnyBar":
        return beatIndex === 0 && measuresIntoVamp % exit.every === 0;
      case "vampOutAnyBeat":
        return beatIndex % exit.every === 0;
    }
  }

  createRepeatJump(repeatIndex: number): RepeatJump {
    return {
      type: "repeat",
      targetFrameIndex: this.inFrameIndex,
      repeatIndex,
    };
  }

  createVampExitJump(repeatIndex: number): VampExitJump {
    return {
      type: "vampExit",
      targetFrameIndex: this.outFrameIndex,
      repeatIndex,
    };
  }
};
