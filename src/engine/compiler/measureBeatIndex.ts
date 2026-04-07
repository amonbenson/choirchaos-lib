import { SongStructureError } from "./errors";

export type MeasureBeatIndex = {
  measure: number;
  beat: number;
};

export function validateMeasureBeatIndex(index: MeasureBeatIndex): void {
  if (index.measure < 0) {
    throw new SongStructureError(`Invalid measure index: ${index.measure}`);
  }

  if (index.beat < 0) {
    throw new SongStructureError(`Invalid index: ${index.beat}`, index.measure);
  }
}
