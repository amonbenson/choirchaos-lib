export type CutJump = {
  readonly type: "cut";
  readonly targetFrameIndex: number;
  readonly cutIndex: number;
};

export type RepeatJump = {
  readonly type: "repeat";
  readonly targetFrameIndex: number;
  readonly repeatIndex: number;
};

export type VampExitJump = {
  readonly type: "vampExit";
  readonly targetFrameIndex: number;
  readonly repeatIndex: number;
};

export type Jump = CutJump | RepeatJump | VampExitJump;
