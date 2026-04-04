import { type Tempo, type TimeSignature } from "@/music";

import { type MeasureNumber } from "./measure";

export type TempoChange = {
  type: "tempoChange";
  value: Tempo;
};

export type TimeSignatureChange = {
  type: "timeSignatureChange";
  value: TimeSignature;
};

export type BeatDirection = TempoChange | TimeSignatureChange;

export type MeasureNumberChange = {
  type: "measureNumberChange";
  value: MeasureNumber;
};

export type Marker = {
  type: "marker";
  value: string;
};

export type Repeat = {
  type: "repeat";
  length: number;
  iterations: number;
};

export type VampExit = { type: "end" }
  | { type: "bar"; every: number }
  | { type: "beat"; every: number };

export type Vamp = {
  type: "vamp";
  length: number;
  exit: VampExit;
  safety: boolean;
};

export type Cut = {
  type: "cut";
  length: number;
};

export type MeasureDirection = MeasureNumberChange | Marker | Repeat | Vamp | Cut;

export type Segue = {
  type: "segue";
  asOne: boolean;
};

export type SongDirection = Segue;

export type Direction = BeatDirection | MeasureDirection | SongDirection;
