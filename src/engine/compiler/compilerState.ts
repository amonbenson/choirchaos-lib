import { type Numbering, type Tempo, type TimeSignature } from "@/music";

export type MeasureCompilerState = {
  readonly time: number;
  readonly measureNumber: Numbering;
  readonly tempo: Tempo;
  readonly timeSignature: TimeSignature;
};
