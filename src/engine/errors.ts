export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

export class SongStructureError extends EngineError {
  constructor(message: string, public readonly measureIndex: number) {
    super(message);
    this.name = "SongStructureError";
  }
}

export class EngineStateError extends EngineError {
  constructor(message: string) {
    super(message);
    this.name = "EngineStateError";
  }
}
