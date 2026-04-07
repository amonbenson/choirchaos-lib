import { type Song } from "@/model/song";
import { Emitter, type Emitters, Property } from "@/utils/events";
import { SetIntervalUpdater, type Updater } from "@/utils/updater";

import Compiler from "./compiler/compiler";
import type CompiledSong from "./compiler/song";
import { EngineStateError } from "./errors";

export default class Engine {
  private readonly emitters = {
    unloaded: new Emitter<void>(),
    ready: new Emitter<void>(),
    error: new Emitter<Error>(),
  } satisfies Emitters;

  readonly onUnload = this.emitters.unloaded.event;
  readonly onReady = this.emitters.ready.event;
  readonly onError = this.emitters.error.event;

  private updater: Updater;
  private compiler: Compiler = new Compiler();

  private song?: Song;
  private compiledSong?: CompiledSong;

  private playing = new Property(false);
  private songTime = new Property(0);
  private songDuration = new Property(0);

  readonly onPlayingChange = this.playing.onChange;
  readonly onSongTimeChange = this.songTime.onChange;
  readonly onSongDurationChange = this.songDuration.onChange;

  constructor(updater?: Updater) {
    // Set the updater or use the default internal one at 50 updates per second
    this.updater = updater ?? new SetIntervalUpdater({
      interval: 1 / 50,
      maximumLag: 5.0,
    });

    // Register updater callback
    this.updater.onTick((delta) => {
      if (this.isReady() && this.isPlaying()) {
        this.update(delta);
      }
    });
  }

  public isReady(): boolean {
    return Boolean(this.song);
  }

  public getSong(): Song | undefined {
    return this.song;
  }

  public getCompiledSong(): CompiledSong | undefined {
    return this.compiledSong;
  }

  public isPlaying(): boolean {
    return this.playing.get();
  }

  public getSongTime(): number {
    return this.songTime.get();
  }

  public getSongDuration(): number {
    return this.songDuration.get();
  }

  private compile(): void {
    if (!this.song) {
      throw new EngineStateError("Engine has no song loaded.");
    }

    // Compile the song
    this.compiledSong = this.compiler.compile(this.song);

    // Reset the playback state
    this.playing.set(false);
    this.songTime.set(0);
    this.songDuration.set(this.compiledSong.duration);

    // TODO: Set playing and seek to the previous location
  }

  private reset(): void {
    this.song = undefined;
    this.compiledSong = undefined;

    this.playing.set(false);
    this.songTime.set(0);
    this.songDuration.set(0);
  }

  load(song: Song): void {
    // Unload previous song
    if (this.isReady()) {
      this.unload();
    }

    try {
      this.song = song;

      this.compile();

      this.emitters.ready.fire();
    } catch (err) {
      this.reset();
      this.emitters.error.fire(err as Error);
    }
  }

  unload(): void {
    // Skip if song has already been unloaded
    if (!this.isReady()) {
      return;
    }

    this.reset();
    this.emitters.unloaded.fire();
  }

  private update(delta: number): void {

  }

  play(): void {

  }

  pause(): void {

  }
}
