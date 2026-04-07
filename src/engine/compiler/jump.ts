import { type MeasureBeatIndex } from "./measureBeatIndex";

export type CutJump = {
  readonly type: "cut";
  readonly targetIndex: MeasureBeatIndex;
  readonly cutIndex: number;
};

export type RepeatJump = {
  readonly type: "repeat";
  readonly targetIndex: MeasureBeatIndex;
  readonly repeatIndex: number;
};

export type VampExitJump = {
  readonly type: "vampExit";
  readonly targetIndex: MeasureBeatIndex;
  readonly repeatIndex: number;
};

export type Jump = CutJump | RepeatJump | VampExitJump;
