import { type Tempo, type TimeSignature } from "@/music";

import { type MeasureNumber } from "./measure";

export type TempoChangeDirection = {
  type: "tempoChange";
  value: Tempo;
};

export type TimeSignatureChangeDirection = {
  type: "timeSignatureChange";
  value: TimeSignature;
};

export type BeatDirection = TempoChangeDirection | TimeSignatureChangeDirection;

export type MeasureNumberChangeDirection = {
  type: "measureNumberChange";
  value: MeasureNumber;
};

export type MarkerDirection = {
  type: "marker";
  value: string;
};

export type RepeatExit
  = { type: "count"; iterations: number }
    | { type: "vamp" }
    | { type: "vampOutAnyBar"; every: number }
    | { type: "vampOutAnyBeat"; every: number };

export type RepeatDirection = {
  type: "repeat";
  length: number;
  exit: RepeatExit;
  safety: boolean;
};

export type CutDirection = {
  type: "cut";
  length: number;
};

export type MeasureDirection = MeasureNumberChangeDirection | MarkerDirection | RepeatDirection | CutDirection;

export type Segue = {
  type: "segue";
  asOne: boolean;
};

export type SongDirection = Segue;

export type Direction = BeatDirection | MeasureDirection | SongDirection;
