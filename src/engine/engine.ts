import { Song } from "@/model/song";
import { Emitter, Emitters } from "@/utils/events";

import { BeatList } from "./beat";

export default class Engine {
  private readonly emitters = {
    unloaded: new Emitter<void>(),
    ready: new Emitter<void>(),
    error: new Emitter<Error>(),
  } satisfies Emitters;

  private song?: Song;
  private beats: BeatList = new BeatList();

  readonly onUnloaded = this.emitters.unloaded.event;
  readonly onReady = this.emitters.ready.event;
  readonly onError = this.emitters.error.event;

  public isReady(): boolean {
    return Boolean(this.song);
  }

  load(song: Song): void {
    // Unload previous song
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

    // Clear all data
    this.song = undefined;
    this.beats.clear();

    this.emitters.unloaded.fire();
  }
}
