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
  private readonly currentFrame = new Property<Frame | undefined>(undefined);

  readonly onLoadedChange: Event<boolean> = this.loaded.onChange;
  readonly onPlayingChange: Event<boolean> = this.playing.onChange;
  readonly onCurrentTimeChange: Event<number> = this.currentTime.onChange;
  readonly onFrameChange: Event<Frame | undefined> = this.currentFrame.onChange;

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
    return this.compiledSong?.duration ?? 0;
  }

  getCurrentFrame(): Frame | undefined {
    return this.currentFrame.get();
  }

  getCurrentTempo(): Tempo {
    return this.currentFrame.get()?.tempo ?? DefaultTempo;
  }

  getCurrentTimeSignature(): TimeSignature {
    return this.currentFrame.get()?.timeSignature ?? DefaultTimeSignature;
  }

  getCurrentMeasureNumber(): Numbering {
    return this.currentFrame.get()?.measureNumber ?? asNumbering("1");
  }

  getCurrentMarker(): Marker | undefined {
    return this.currentFrame.get()?.marker;
  }

  getCurrentRepeat(): Repeat | undefined {
    return this.currentFrame.get()?.repeat;
  }

  getCurrentCut(): Cut | undefined {
    return this.currentFrame.get()?.cut;
  }

  load(compiledSong: CompiledSong): void {
    this.compiledSong = compiledSong;
    this.playing.set(false);

    // Follow the jumps of the initial frame
    this.seekToFrame(compiledSong.frames[0], true);

    this.loaded.set(true);
  }

  unload(): void {
    this.loaded.set(false);
    this.compiledSong = undefined;
    this.playing.set(false);
    this.currentTime.set(0);
    this.currentFrame.set(undefined);
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

  private calculateTargetTime(frame: Frame, time: number, targetFrame: Frame): number {
    let timeIntoTargetFrame = time - frame.time;

    if (timeIntoTargetFrame >= targetFrame.duration) {
      console.warn("Step size too large! Time stretching will occur.");
      timeIntoTargetFrame = targetFrame.duration - 0.0001;
    }

    return targetFrame.time + timeIntoTargetFrame;
  }

  private followSpecificJump(frame: Frame, time: number, jump: Jump): [Frame, number] {
    const targetFrame = this.compiledSong!.frames[jump.targetFrameIndex] ?? this.compiledSong!.stopFrame;
    const targetTime = this.calculateTargetTime(frame, time, targetFrame);
    return [targetFrame, targetTime];
  }

  private selectNextJump(frame: Frame): Jump | undefined {
    for (const jump of frame.jumps) {
      switch (jump.type) {
        case "cut":
          return jump;
        case "repeat":
          // If we are paused, repeat jumps will not be followed (also applies to seeking)
          if (!this.playing.get()) {
            break;
          }

          // TODO: conditional
          return jump;
        case "vampExit":
          // If we are paused, repeat jumps will not be followed (also applies to seeking)
          if (!this.playing.get()) {
            break;
          }

          // TODO: conditional
          return jump;
        default:
          throw new EngineStateError(`Invalid jump type: ${(jump as Jump).type}`);
      }
    }

    return undefined;
  }

  private followJumps(frame: Frame, time: number): [Frame, number] {
    for (let i = 0; i < 100; i++) {
      // Check if there is a jump we need to follow
      const jump = this.selectNextJump(frame);

      // If not, return the current frame and time
      if (!jump) {
        return [frame, time];
      }

      // If yes, apply that jump and continue following jumps from here
      [frame, time] = this.followSpecificJump(frame, time, jump);
    }

    throw new EngineStateError("Jump cycle detected (maximum number of jumps reached)!");
  }

  private seekToFrame(frame: Frame, followJumps: boolean = false): void {
    if (followJumps) {
      const [adjustedFrame, adjustedTime] = this.followJumps(frame, frame.time);
      this.currentTime.set(adjustedTime);
      this.currentFrame.set(adjustedFrame);
    } else {
      this.currentTime.set(frame.time);
      this.currentFrame.set(frame);
    }
  }

  seek(time: number, followJumps: boolean = false): void {
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

    // Use binary search to find the requested frame
    time = Math.max(0, Math.min(time, this.compiledSong.duration));
    const frameIndex = binarySearch(this.compiledSong.frames, time, {
      comparator: (t, frame) => t - frame.time,
      direction: "backward",
      inclusive: true,
      extend: true,
    });
    let frame = this.compiledSong.frames[frameIndex] ?? this.compiledSong.stopFrame;

    // Optionally follow jumps for the target frame.
    // Quantize to the frame starting point
    if (followJumps) {
      [frame, time] = this.followJumps(frame, frame.time);
    }

    // Update the current frame and time
    this.currentFrame.set(frame);
    this.currentTime.set(time);

    // Restore playback
    if (wasPlaying) {
      this.play();
    }
  }

  step(delta: number): void {
    if (!this.compiledSong) {
      return;
    }

    if (!this.playing.get()) {
      throw new EngineStateError("Cannot call step() while paused.");
    }

    const currentFrame = this.currentFrame.get();
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
      [nextFrame, nextTime] = this.followJumps(nextFrame, nextTime);

      // Stop playback if we've reached the end of the song
      const songDuration = this.getSongDuration();
      if (nextTime >= songDuration) {
        nextTime = songDuration;
        this.playing.set(false);
      }

      // Update the current frame
      this.currentFrame.set(nextFrame);
    }

    // Update the current time
    this.currentTime.set(nextTime);
  }
}
