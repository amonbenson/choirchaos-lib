const BrandTypeId: unique symbol = Symbol.for("effect/Brand");

export type NoteType = number & { readonly [BrandTypeId]: { readonly SongId: "NoteType" } };

export type NoteValue = {
  type: NoteType;
  dots: number;
};

export const WholeNote: NoteValue = { type: 0 as NoteType, dots: 0 };
export const DottedWholeNote: NoteValue = { type: 0 as NoteType, dots: 1 };
export const HalfNote: NoteValue = { type: -1 as NoteType, dots: 0 };
export const DottedHalfNote: NoteValue = { type: -1 as NoteType, dots: 1 };
export const QuarterNote: NoteValue = { type: -2 as NoteType, dots: 0 };
export const DottedQuarterNote: NoteValue = { type: -2 as NoteType, dots: 1 };
export const EightNote: NoteValue = { type: -3 as NoteType, dots: 0 };
export const DottedEightNote: NoteValue = { type: -3 as NoteType, dots: 1 };
export const SixteenthNote: NoteValue = { type: -4 as NoteType, dots: 0 };
export const DottedSixteenthNote: NoteValue = { type: -4 as NoteType, dots: 1 };
export const ThirtySecondNote: NoteValue = { type: -5 as NoteType, dots: 0 };
export const DottedThirtySecondNote: NoteValue = { type: -5 as NoteType, dots: 1 };
