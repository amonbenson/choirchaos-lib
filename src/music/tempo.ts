import { type NoteValue, QuarterNote } from "./noteValue";

export type Tempo = {
  bpm: number;
  pulse: NoteValue;
};

export const DefaultTempo: Tempo = { bpm: 120, pulse: QuarterNote };
