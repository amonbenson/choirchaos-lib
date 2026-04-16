import { type Song } from "@/model/song";
import { type Numbering, type Tempo, type TimeSignature } from "@/music";
import { type Event, Property } from "@/utils/events";

import { AudioEngine } from "./audio";
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
  private readonly audioEngine?: AudioEngine;

  private song: Song | undefined;
  private compiledSong: CompiledSong | undefined;

  private readonly ready = new Property(false);

  readonly onReadyChange: Event<boolean> = this.ready.onChange;
  readonly onPlayingChange: Event<boolean> = this.transport.onPlayingChange;
  readonly onCurrentTimeChange: Event<number> = this.transport.onCurrentTimeChange;
  readonly onFrameChange: Event<Frame | undefined> = this.transport.onFrameChange;

  constructor(options: { clock?: Clock; audio?: boolean } = {}) {
    this.clock = options.clock ?? new SetIntervalClock();
    this.clock.setup(this.transport);

    this.audioEngine = options.audio !== false ? new AudioEngine(this.transport) : undefined;
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

  getCurrentTime(): number {
    return this.transport.getCurrentTime();
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
    this.audioEngine?.dispose();
    this.clock.dispose();
  }
}
