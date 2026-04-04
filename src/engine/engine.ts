import { Song } from "@/model/song";
import { Emitter, Emitters } from "@/utils/events";

export default class Engine {
  private readonly emitters = {
    unloaded: new Emitter<void>(),
    ready: new Emitter<void>(),
    error: new Emitter<Error>(),
  } satisfies Emitters;

  private song?: Song;

  readonly onUnloaded = this.emitters.unloaded.event;
  readonly onReady = this.emitters.ready.event;
  readonly onError = this.emitters.error.event;

  public isReady(): boolean {
    return !!this.song;
  }

  load(song: Song): void {
    // onload previous song
    if (this.isReady()) {
      this.unload();
    }

    try {
      this.song = song;

      this.emitters.ready.fire();
    } catch (err) {
      this.song = undefined;
      this.emitters.error.fire(err as Error);
    }
  }

  unload(): void {
    // Skip if song has already been unloaded
    if (!this.isReady()) {
      return;
    }

    this.song = undefined;
    this.emitters.unloaded.fire();
  }
}
