import { type Song } from "@/model/song";

import { type MeasureBeatLabel } from "./beat";

export class CompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompilerError";
  }
}

export class CompilerStateError extends CompilerError {
  constructor(message: string) {
    super(message);
    this.name = "CompilerStateError";
  }
}

export class SongStructureError extends CompilerError {
  constructor(message: string, public song: Song, public measureBeatLabel: MeasureBeatLabel) {
    super(message);
    this.name = "SongStructureError";
  }
}
