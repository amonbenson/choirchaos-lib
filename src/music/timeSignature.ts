export type BeatType = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128;

export type TimeSignature = {
  beats: number;
  denominator: BeatType;
};
