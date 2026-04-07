import type CompiledBeat from "./beat";
import type Cut from "./cut";
import type Repeat from "./repeat";

export default class Jump {
  constructor(
    public readonly beat: CompiledBeat,
  ) {}
};

export class CutJump extends Jump {
  constructor(
    public readonly beat: CompiledBeat,
    public readonly cut: Cut,
  ) {
    super(beat);
  }
}

export class RepeatJump extends Jump {
  constructor(
    public readonly beat: CompiledBeat,
    public readonly repeat: Repeat,
  ) {
    super(beat);
  }
}

export class VampExitJump extends Jump {
  constructor(
    public readonly beat: CompiledBeat,
    public readonly repeat: Repeat,
  ) {
    super(beat);
  }
}
