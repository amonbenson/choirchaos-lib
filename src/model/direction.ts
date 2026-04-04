import { Tempo, TimeSignature } from "@/music";

import { BeatNumber } from "./beat";

export type Marker = {
  type: "marker";
  text: string;
};

export type TempoChange = {
  type: "tempoChange";
  value: Tempo;
};

export type TimeSignatureChange = {
  type: "timeSignatureChange";
  value: TimeSignature;
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
  iterations: number;
};

export type MeasureDirection = Marker | TempoChange | TimeSignatureChange | Repeat | Vamp | Cut;

export type Segue = {
  type: "segue";
  asOne: boolean;
};

export type SongDirection = Segue;
