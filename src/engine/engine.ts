import { type Song } from "@/model/song";
import { type Numbering, type Tempo, type TimeSignature } from "@/music";
import { type Event, Property } from "@/utils/events";

import { type Clock, SetIntervalClock } from "./clock";
import type CompiledSong from "./compiler/compiledSong";
import Compiler from "./compiler/compiler";
import type Cut from "./compiler/cut";
import type Frame from "./compiler/frame";
import type Marker from "./compiler/marker";
import type Repeat from "./compiler/repeat";
import Transport from "./transport";

export default class Engine {
  private readonly compiler = new Compiler();
  private readonly transport = new Transport();
  private readonly clock: Clock;

  private song: Song | undefined;
  private compiledSong: CompiledSong | undefined;

  private readonly ready = new Property(false);

  readonly onReadyChange: Event<boolean> = this.ready.onChange;
  readonly onPlayingChange: Event<boolean> = this.transport.onPlayingChange;
  readonly onSongTimeChange: Event<number> = this.transport.onSongTimeChange;
  readonly onSongDurationChange: Event<number> = this.transport.onSongDurationChange;
  readonly onFrameChange: Event<Frame | undefined> = this.transport.onFrameChange;

  constructor(clock?: Clock) {
    this.clock = clock ?? new SetIntervalClock();
    this.clock.setup(this.transport);
  }

  isReady(): boolean {
    return this.ready.get();
  }

  getSong(): Song | undefined {
    return this.song;
  }

  getCompiledSong(): CompiledSong | undefined {
    return this.compiledSong;
  }

  isPlaying(): boolean {
    return this.transport.isPlaying();
  }

  getSongTime(): number {
    return this.transport.getSongTime();
  }

  getSongDuration(): number {
    return this.transport.getSongDuration();
  }

  getCurrentFrame(): Frame | undefined {
    return this.transport.getCurrentFrame();
  }

  getCurrentTempo(): Tempo {
    return this.transport.getCurrentTempo();
  }

  getCurrentTimeSignature(): TimeSignature {
    return this.transport.getCurrentTimeSignature();
  }

  getCurrentMeasureNumber(): Numbering {
    return this.transport.getCurrentMeasureNumber();
  }

  getCurrentMarker(): Marker | undefined {
    return this.transport.getCurrentMarker();
  }

  getCurrentRepeat(): Repeat | undefined {
    return this.transport.getCurrentRepeat();
  }

  getCurrentCut(): Cut | undefined {
    return this.transport.getCurrentCut();
  }

  play(): void {
    this.transport.play();
  }

  pause(): void {
    this.transport.pause();
  }

  seek(time: number): void {
    this.transport.seek(time);
  }

  load(song: Song): void {
    if (this.isReady()) {
      this.unload();
    }

    try {
      this.song = song;
      this.compiledSong = this.compiler.compile(song);
      this.transport.load(this.compiledSong);
      this.ready.set(true);
    } catch (err) {
      this.song = undefined;
      this.compiledSong = undefined;
      this.ready.set(false);
      throw err;
    }
  }

  unload(): void {
    if (!this.isReady()) {
      return;
    }

    this.transport.unload();
    this.song = undefined;
    this.compiledSong = undefined;
    this.ready.set(false);
  }

  dispose(): void {
    this.clock.dispose();
  }
}
