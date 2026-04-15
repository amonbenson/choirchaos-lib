import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, type Numbering, type Tempo, type TimeSignature } from "@/music";
import { binarySearch } from "@/utils/binarySearch";
import { type Event, Property } from "@/utils/events";

import type CompiledSong from "./compiler/compiledSong";
import type Cut from "./compiler/cut";
import type Frame from "./compiler/frame";
import type Marker from "./compiler/marker";
import type Repeat from "./compiler/repeat";

/**
 * Manages playback position and state for a compiled song.
 *
 * The transport tracks the current frame, song time, and play/pause state.
 * It does not run any timers — call step() externally (e.g. from a Clock)
 * to advance playback.
 */
export default class Transport {
  private compiledSong: CompiledSong | undefined;

  private readonly loaded = new Property(false);
  private readonly playing = new Property(false);
  private readonly songTime = new Property(0);
  private readonly songDuration = new Property(0);
  private readonly frame = new Property<Frame | undefined>(undefined);

  readonly onLoadedChange: Event<boolean> = this.loaded.onChange;
  readonly onPlayingChange: Event<boolean> = this.playing.onChange;
  readonly onSongTimeChange: Event<number> = this.songTime.onChange;
  readonly onSongDurationChange: Event<number> = this.songDuration.onChange;
  readonly onFrameChange: Event<Frame | undefined> = this.frame.onChange;

  getCompiledSong(): CompiledSong | undefined {
    return this.compiledSong;
  }

  getSong(): Song | undefined {
    return this.compiledSong?.source;
  }

  isLoaded(): boolean {
    return this.compiledSong !== undefined;
  }

  isPlaying(): boolean {
    return this.playing.get();
  }

  getSongTime(): number {
    return this.songTime.get();
  }

  getSongDuration(): number {
    return this.songDuration.get();
  }

  getCurrentFrame(): Frame | undefined {
    return this.frame.get();
  }

  getCurrentTempo(): Tempo {
    return this.frame.get()?.tempo ?? DefaultTempo;
  }

  getCurrentTimeSignature(): TimeSignature {
    return this.frame.get()?.timeSignature ?? DefaultTimeSignature;
  }

  getCurrentMeasureNumber(): Numbering {
    return this.frame.get()?.measureNumber ?? asNumbering("1");
  }

  getCurrentMarker(): Marker | undefined {
    return this.frame.get()?.marker;
  }

  getCurrentRepeat(): Repeat | undefined {
    return this.frame.get()?.repeat;
  }

  getCurrentCut(): Cut | undefined {
    return this.frame.get()?.cut;
  }

  load(compiledSong: CompiledSong): void {
    this.compiledSong = compiledSong;
    this.playing.set(false);
    this.songDuration.set(compiledSong.duration);
    this.songTime.set(0);
    this.frame.set(compiledSong.frames[0]);
    this.loaded.set(true);
  }

  unload(): void {
    this.loaded.set(false);
    this.compiledSong = undefined;
    this.playing.set(false);
    this.songDuration.set(0);
    this.songTime.set(0);
    this.frame.set(undefined);
  }

  play(): void {
    if (!this.compiledSong || this.playing.get()) {
      return;
    }

    this.playing.set(true);
  }

  pause(): void {
    if (!this.playing.get()) {
      return;
    }

    this.playing.set(false);
  }

  seek(time: number): void {
    if (!this.compiledSong) {
      return;
    }

    // Skip if the time is already set
    if (this.songTime.get() === time) {
      return;
    }

    // Stop playing during seek
    const wasPlaying = this.playing.get();
    if (wasPlaying) {
      this.pause();
    }

    // Use binary search to find the requested index
    const clampedTime = Math.max(0, Math.min(time, this.compiledSong.duration));
    const index = binarySearch(this.compiledSong.frames, clampedTime, {
      comparator: (t, frame) => t - frame.time,
      direction: "backward",
      inclusive: true,
      extend: true,
    });

    // Update the current frame and song time
    this.frame.set(this.compiledSong.frames[Math.max(0, index)]);
    this.songTime.set(clampedTime);

    // Restore playback
    if (wasPlaying) {
      this.play();
    }
  }

  step(delta: number): void {
    const { compiledSong } = this;

    if (!compiledSong) {
      return;
    }

    const initial = this.frame.get();

    if (!initial) {
      return;
    }

    let frame: Frame = initial;
    let time = this.songTime.get() + delta;

    while (time >= frame.time + frame.duration) {
      // TODO: Check frame.jumps and execute applicable ones (cuts, repeats, vamps).
      const next = compiledSong.frames[frame.index + 1];

      if (!next) {
        time = compiledSong.duration;
        this.playing.set(false);
        break;
      }

      frame = next;
    }

    this.frame.set(frame);
    this.songTime.set(time);
  }
}
