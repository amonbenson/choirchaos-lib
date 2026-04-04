import { Tempo, TimeSignature } from "@/music";

import { BeatNumber } from "./beat";
import { MeasureNumber } from "./measure";

export type MeasureNumberChange = {
  type: "measureNumberChange";
  value: MeasureNumber;
};

export type TempoChange = {
  type: "tempoChange";
  value: Tempo;
};

export type TimeSignatureChange = {
  type: "timeSignatureChange";
  value: TimeSignature;
};

export type Marker = {
  type: "marker";
  value: string;
};

export type Repeat = {
  type: "repeat";
  length: BeatNumber;
  iterations: number;
};

export type VampExit = { type: "end" }
  | { type: "bar"; every: number }
  | { type: "beat"; every: number };

export type Vamp = {
  type: "vamp";
  length: BeatNumber;
  exit: VampExit;
  safety: boolean;
};

export type Cut = {
  type: "cut";
  length: BeatNumber;
};

export type MeasureDirection = MeasureNumberChange | TempoChange | TimeSignatureChange | Marker | Repeat | Vamp | Cut;

export type Segue = {
  type: "segue";
  asOne: boolean;
};

export type SongDirection = Segue;
