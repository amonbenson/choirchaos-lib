export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

export class EngineStateError extends EngineError {
  constructor(message: string) {
    super(message);
    this.name = "EngineStateError";
  }
}

export class EngineAudioStateError extends EngineStateError {
  constructor(message: string) {
    super(message);
    this.name = "EngineAudioStateError";
  }
}
