import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, type Numbering, type Tempo, type TimeSignature } from "@/music";
import { binarySearch } from "@/utils/binarySearch";
import { type Event, Property } from "@/utils/events";

import { type Jump } from "./compiler";
import type CompiledSong from "./compiler/compiledSong";
import type Cut from "./compiler/cut";
import type Frame from "./compiler/frame";
import type Marker from "./compiler/marker";
import type Repeat from "./compiler/repeat";
import { EngineStateError } from "./errors";

export type RepeatState = {
  currentIteration: number;
  iterations: number;
  exitRequested: boolean;
};

export default class Transport {
  private compiledSong: CompiledSong | undefined;

  private readonly loaded = new Property(false);
  private readonly playing = new Property(false);
  private readonly currentTime = new Property(0);
  private readonly songDuration = new Property(0);
  private readonly frame = new Property<Frame | undefined>(undefined);

  readonly onLoadedChange: Event<boolean> = this.loaded.onChange;
  readonly onPlayingChange: Event<boolean> = this.playing.onChange;
  readonly onCurrentTimeChange: Event<number> = this.currentTime.onChange;
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

  getCurrentTime(): number {
    return this.currentTime.get();
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
    this.currentTime.set(0);
    this.frame.set(compiledSong.frames[0]);
    this.loaded.set(true);
  }

  unload(): void {
    this.loaded.set(false);
    this.compiledSong = undefined;
    this.playing.set(false);
    this.songDuration.set(0);
    this.currentTime.set(0);
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
    if (this.currentTime.get() === time) {
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

    // Update the current frame and time
    this.frame.set(this.compiledSong.frames[Math.max(0, index)]);
    this.currentTime.set(clampedTime);

    // Restore playback
    if (wasPlaying) {
      this.play();
    }
  }

  private calculateTargetTime(frame: Frame, time: number, targetFrame: Frame): number {
    let timeIntoTargetFrame = time - frame.time;

    if (timeIntoTargetFrame >= targetFrame.duration) {
      console.warn("Step size too large! Time stretching will occur.");
      timeIntoTargetFrame = targetFrame.duration - 0.0001;
    }

    return targetFrame.time + timeIntoTargetFrame;
  }

  private selectNextJump(frame: Frame): Jump | undefined {
    for (const jump of frame.jumps) {
      switch (jump.type) {
        case "cut":
          return jump;
        case "repeat":
          // TODO: conditional
          return jump;
        case "vampExit":
          // TODO: conditional
          return jump;
        default:
          throw new EngineStateError(`Invalid jump type: ${(jump as Jump).type}`);
      }
    }

    return undefined;
  }

  private applySpecificJump(frame: Frame, time: number, jump: Jump): [Frame, number] {
    const targetFrame = this.compiledSong!.frames[jump.targetFrameIndex] ?? this.compiledSong!.stopFrame;
    const targetTime = this.calculateTargetTime(frame, time, targetFrame);
    return [targetFrame, targetTime];
  }

  private applyJumps(frame: Frame, time: number): [Frame, number] {
    for (let i = 0; i < 100; i++) {
      // Check if there is a jump we need to follow
      const jump = this.selectNextJump(frame);

      // If not, return the current frame and time
      if (!jump) {
        return [frame, time];
      }

      // If yes, apply that jump and continue following jumps from here
      [frame, time] = this.applySpecificJump(frame, time, jump);
    }

    throw new EngineStateError("Jump cycle detected (maximum number of jumps reached)!");
  }

  step(delta: number): void {
    if (!this.compiledSong) {
      return;
    }

    if (!this.playing.get()) {
      throw new EngineStateError("Cannot call step() while paused.");
    }

    const currentFrame = this.frame.get();
    if (!currentFrame) {
      return;
    }

    const currentTime = this.currentTime.get();
    let nextTime = currentTime + delta;

    // Check if we need to move on to the next frame
    if (nextTime >= currentFrame.time + currentFrame.duration) {
      // Get the next frame in order. Use stopFrame as a fallback if we've moved past the end of the song.
      let nextFrame = this.compiledSong.frames[currentFrame.index + 1] ?? this.compiledSong.stopFrame;

      // Apply jumps for his frame
      [nextFrame, nextTime] = this.applyJumps(nextFrame, nextTime);

      // Stop playback if we've reached the end
      if (nextTime >= this.songDuration.get()) {
        nextTime = this.songDuration.get();
        this.playing.set(false);
      }

      // Update the current frame
      this.frame.set(nextFrame);
    }

    // Update the current time
    this.currentTime.set(nextTime);
  }
}
