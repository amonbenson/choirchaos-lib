export class CompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompilerError";
  }
}

export class SongStructureError extends CompilerError {
  constructor(message: string, public readonly measureIndex?: number, public readonly beatIndex?: number) {
    super(message);
    this.name = "SongStructureError";
  }
}

export class CompilerStateError extends CompilerError {
  constructor(message: string) {
    super(message);
    this.name = "CompilerStateError";
  }
}
