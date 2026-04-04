import { type MeasureDirection } from "@/model/direction";

// Clash guard to prevent MeasureDirection subtypes from implementing their own measure index
export type ResolvedDirection<T extends MeasureDirection & { measureIndex?: never }> = T & {
  measureIndex: number;
};
