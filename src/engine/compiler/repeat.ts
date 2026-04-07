import { type RepeatDirection } from "@/model/direction";

import { type RepeatJump, type VampExitJump } from "./jump";

export default class Repeat {
  constructor(
    public readonly inMeasureIndex: number,
    public readonly outMeasureIndex: number,
    public readonly sourceDirection: RepeatDirection,
  ) {}

  isVampExit(measureIndex: number, beatIndex: number, isRepeatIn: boolean): boolean {
    const exit = this.sourceDirection.exit;
    const measuresIntoVamp = measureIndex - this.inMeasureIndex;

    switch (exit.type) {
      case "count":
        return false;
      case "vamp":
        return isRepeatIn && beatIndex === 0;
      case "vampOutAnyBar":
        return beatIndex === 0 && measuresIntoVamp % exit.every === 0;
      case "vampOutAnyBeat":
        return beatIndex % exit.every === 0;
    }
  }

  createRepeatJump(repeatIndex: number): RepeatJump {
    return {
      type: "repeat",
      targetIndex: { measure: this.inMeasureIndex, beat: 0 },
      repeatIndex,
    };
  }

  createVampExitJump(repeatIndex: number): VampExitJump {
    return {
      type: "vampExit",
      targetIndex: { measure: this.outMeasureIndex, beat: 0 },
      repeatIndex,
    };
  }
};
