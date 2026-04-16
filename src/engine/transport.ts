import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, type Numbering, type Tempo, type TimeSignature } from "@/music";
import { binarySearch } from "@/utils/binarySearch";
import { Emitter, type Emitters, Property } from "@/utils/events";

import { type Jump } from "./compiler";
import type CompiledSong from "./compiler/compiledSong";
import type Cut from "./compiler/cut";
import type Frame from "./compiler/frame";
import type Marker from "./compiler/marker";
import type Repeat from "./compiler/repeat";
import { EngineStateError } from "./errors";

export type Location = {
  frame: Frame;
  time: number;
};

export type Region = {
  frame: Frame;
  startTime: number;
  endTime: number;
};

export type RepeatState = {
  currentIteration: number;
  iterations: number;
  exitRequested: boolean;
};

export default class Transport {
  private emitters = {
    seek: new Emitter<Location>(),
    render: new Emitter<Region>(),
  } satisfies Emitters;

  private compiledSong: CompiledSong | undefined;

  private readonly loaded = new Property(false);
  private readonly playing = new Property(false);
  private readonly currentTime = new Property(0);
  private readonly currentFrame = new Property<Frame | undefined>(undefined);

  readonly onLoadedChange = this.loaded.onChange;
  readonly onPlayingChange = this.playing.onChange;
  readonly onCurrentTimeChange = this.currentTime.onChange;
  readonly onFrameChange = this.currentFrame.onChange;

  readonly onSeek = this.emitters.seek.event;
  readonly onRender = this.emitters.render.event;

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

  private getCompiledSongAsserted(): CompiledSong {
    if (!this.compiledSong) {
      throw new EngineStateError("Compiled song is undefined!");
    }

    return this.compiledSong;
  }

  private getCurrentFrameAsserted(): Frame {
    const frame = this.currentFrame.get();

    if (!frame) {
      throw new EngineStateError("Current frame is undefined!");
    }

    return frame;
  }

  private assertFrameContainsTime(frame: Frame, time: number): void {
    const tmin = frame.time;
    const tmax = frame.time + frame.duration;

    if (time < tmin || time >= tmax) {
      throw new EngineStateError(`Consistency check failed: time (${time}) is outside the frame region: ${tmin}..${tmax}`);
    }
  }

  private adjustTime(currentFrame: Frame, currentTime: number, targetFrame: Frame): number {
    let timeIntoTargetFrame = currentTime - currentFrame.time;

    if (timeIntoTargetFrame < 0) {
      console.warn("Delta time negative! Something's fucked.");
      timeIntoTargetFrame = 0;
    }

    if (timeIntoTargetFrame >= targetFrame.duration) {
      console.warn("Delta time too large! Time stretching will occur.");
      timeIntoTargetFrame = targetFrame.duration - 0.0001;
    }

    return targetFrame.time + timeIntoTargetFrame;
  }

  private followSpecificJump(frame: Frame, time: number, jump: Jump): [Frame, number] {
    const targetFrame = this.compiledSong!.frames[jump.targetFrameIndex] ?? this.compiledSong!.stopFrame;
    const targetTime = this.adjustTime(frame, time, targetFrame);
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

  private setLocation(frame: Frame, time: number): void {
    // Consistency-check
    this.assertFrameContainsTime(frame, time);

    // Update the properties
    this.currentFrame.set(frame);
    this.currentTime.set(time);
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

  seek(time: number, followJumps: boolean = false): void {
    const compiledSong = this.getCompiledSongAsserted();

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
    time = Math.max(0, Math.min(time, this.getSongDuration()));
    const frameIndex = binarySearch(compiledSong.frames, time, {
      comparator: (t, frame) => t - frame.time,
      direction: "backward",
      inclusive: true,
      extend: true,
    });
    let frame = compiledSong.frames[frameIndex] ?? compiledSong.stopFrame;

    // Optionally follow jumps for the target frame.
    // Quantize to the frame starting point
    if (followJumps) {
      [frame, time] = this.followJumps(frame, frame.time);
    }

    // Update the current frame and time
    this.setLocation(frame, time);

    // Fire seek event
    this.emitters.seek.fire({ frame, time });

    // Restore playback
    if (wasPlaying) {
      this.play();
    }
  }

  private seekToFrame(frame: Frame, followJumps: boolean = false): void {
    let time = frame.time;

    if (followJumps) {
      [frame, time] = this.followJumps(frame, time);
    }

    // Check frame-time correlation
    this.setLocation(frame, time);

    // Fire seek event
    this.emitters.seek.fire({ frame, time });
  }

  step(delta: number): void {
    if (!this.playing.get()) {
      throw new EngineStateError("Cannot call step() while paused.");
    }

    if (!this.compiledSong) {
      return;
    }

    const currentFrame = this.getCurrentFrameAsserted();
    let nextFrame = currentFrame;

    const currentTime = this.currentTime.get();
    let nextTime = currentTime + delta;

    this.assertFrameContainsTime(currentFrame, currentTime);

    // Check if we need to move on to the next frame
    if (nextTime >= currentFrame.time + currentFrame.duration) {
      // Get the next frame in order. Use stopFrame as a fallback if we've moved past the end of the song.
      nextFrame = this.compiledSong.frames[currentFrame.index + 1] ?? this.compiledSong.stopFrame;

      // Adjust delta time. Passing in the same frame will not alter the time, except if it is out of the frame bounds.
      nextTime = this.adjustTime(nextFrame, nextTime, nextFrame);

      // Apply jumps for his frame
      [nextFrame, nextTime] = this.followJumps(nextFrame, nextTime);

      // Stop playback if we've reached the end of the song
      const songDuration = this.getSongDuration();
      if (nextTime >= songDuration) {
        nextTime = songDuration;
        this.playing.set(false);
      }
    }

    this.setLocation(nextFrame, nextTime);

    // Fire render events
    if (currentFrame === nextFrame) {
      // Use a single region inside the current frame
      this.emitters.render.fire({
        frame: currentFrame,
        startTime: currentTime,
        endTime: nextTime,
      });
    } else {
      // Split into two regions:
      // - old time .. end of old frame
      // - start of new frame .. new time
      this.emitters.render.fire({
        frame: currentFrame,
        startTime: currentTime,
        endTime: currentFrame.time + currentFrame.duration,
      });
      this.emitters.render.fire({
        frame: nextFrame,
        startTime: nextFrame.time,
        endTime: nextTime,
      });
    }
  }
}
