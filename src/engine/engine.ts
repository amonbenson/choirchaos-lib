import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, type Numbering, type Tempo, type TimeSignature } from "@/music";
import { Property } from "@/utils/events";
import { SetIntervalUpdater, type Updater } from "@/utils/updater";

import { type CompiledBeat, type CompiledMeasure, type Marker, type MeasureBeatIndex, type Repeat } from "./compiler";
import Compiler from "./compiler/compiler";
import type CompiledSong from "./compiler/compiledSong";
import { EngineStateError } from "./errors";

export default class Engine {
  private readonly updater: Updater;
  private readonly compiler: Compiler = new Compiler();

  private song?: Song;
  private compiledSong?: CompiledSong;

  private readonly ready = new Property(false);
  private readonly playing = new Property(false);
  private readonly songTime = new Property(0);
  private readonly songDuration = new Property(0);

  private readonly currentBeatIndex = new Property<number>(0);
  private readonly currentMeasure = new Property<CompiledMeasure | undefined>(undefined);
  private readonly currentBeat = new Property<CompiledBeat | undefined>(undefined);

  readonly onReadyChange = this.ready.onChange;
  readonly onPlayingChange = this.playing.onChange;
  readonly onSongTimeChange = this.songTime.onChange;
  readonly onSongDurationChange = this.songDuration.onChange;

  readonly onCurrentMeasureChange = this.currentMeasure.onChange;
  readonly onCurrentBeatChange = this.currentBeat.onChange;

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

    // Sync current measure and current beat to the index
    this.currentBeatIndex.onChange(() => this.syncCurrentMeasureBeat());
    this.onReadyChange(() => this.syncCurrentMeasureBeat());
  }

  private syncCurrentMeasureBeat(): void {
    // Clear current references if no song is loaded
    if (!this.compiledSong) {
      this.currentMeasure.set(undefined);
      this.currentBeat.set(undefined);
      return;
    }

    const beat = this.compiledSong.beatIndex.items()[this.currentBeatIndex.get()];
    this.currentBeat.set(beat);

    const measure = this.compiledSong.measures[beat.index.measure];
    this.currentMeasure.set(measure);
  }

  public isReady(): boolean {
    return this.ready.get();
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

  public getCurrentMeasure(): CompiledMeasure | undefined {
    return this.currentMeasure.get();
  }

  public getCurrentBeat(): CompiledBeat | undefined {
    return this.currentBeat.get();
  }

  public getCurrentTempo(): Tempo {
    return this.currentBeat.get()?.tempo ?? DefaultTempo;
  }

  public getCurrentTimeSignature(): TimeSignature {
    return this.currentBeat.get()?.timeSignature ?? DefaultTimeSignature;
  }

  public getCurrentMeasureNumber(): Numbering {
    return this.currentMeasure.get()?.number ?? asNumbering("1");
  }

  public getCurrentMarker(): Marker | undefined {
    return this.currentMeasure.get()?.marker;
  }

  public getCurrentRepeat(): Repeat | undefined {
    return this.currentMeasure.get()?.repeat;
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
    this.currentBeatIndex.set(0);

    // TODO: Set playing and seek to the previous location
  }

  private reset(): void {
    this.song = undefined;
    this.compiledSong = undefined;

    this.playing.set(false);
    this.songTime.set(0);
    this.songDuration.set(0);
    this.currentBeatIndex.set(0);
  }

  load(song: Song): void {
    // Unload previous song
    if (this.isReady()) {
      this.unload();
    }

    try {
      this.song = song;

      this.compile();

      this.songTime.set(0);

      this.ready.set(true);
    } catch (err) {
      this.reset();
      this.ready.set(false);
      throw err;
    }
  }

  unload(): void {
    // Skip if song has already been unloaded
    if (!this.isReady()) {
      return;
    }

    this.reset();
    this.ready.set(false);
  }

  private update(delta: number): void {
    const beat = this.currentBeat.get();
    if (!this.compiledSong || !beat) {
      throw new EngineStateError("Invalid internal state: update() called without a song set.");
    }

    const time = this.songTime.get();
    const nextTime = time + delta;

    // Check if the next time would result in a new beat
    if (nextTime >= beat.time + beat.duration) {
      const nextBeat = this.currentBeatIndex;
    }
  }

  play(): void {
    if (this.isPlaying()) {
      return;
    }

    this.playing.set(true);
  }

  pause(): void {
    if (!this.isPlaying()) {
      return;
    }
  }

  seek(time: number): void {
    const wasPlaying = this.isPlaying();
    this.pause();

    // Continue playback
    if (wasPlaying) {
      this.play();
    }
  }
}
