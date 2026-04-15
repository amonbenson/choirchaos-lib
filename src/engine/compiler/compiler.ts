import { type Beat } from "@/model/beat";
import { type BeatDirection, type CutDirection, type MarkerDirection, type MeasureDirection, type RepeatDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, nextSequentialNumbering, type Numbering, type Tempo, type TimeSignature } from "@/music";

import CompiledSong from "./compiledSong";
import Cut from "./cut";
import { CompilerStateError, SongStructureError } from "./errors";
import Frame from "./frame";
import Marker from "./marker";
import Repeat from "./repeat";

export class CompilerState {
  constructor(
    public frames: Frame[] = [],
    public measureFrameIndices: number[] = [],

    public markers: Marker[] = [],
    public repeats: Repeat[] = [],
    public cuts: Cut[] = [],

    public frameIndex: number = 0,
    public measureNumber: Numbering = asNumbering("1"),

    public time: number = 0,
    public tempo: Tempo = DefaultTempo,
    public timeSignature: TimeSignature = DefaultTimeSignature,
  ) {}

  getFrameByMeasureIndex(measureIndex: number): Frame {
    const frameIndex = this.measureFrameIndices[measureIndex];
    if (frameIndex === undefined) {
      throw new SongStructureError(`Direction extends past the end of the song.`);
    }

    return this.frames[frameIndex]!;
  }
}

export default class Compiler {
  private static stopMeasure(): Measure {
    return {
      beats: [{ directions: [] }],
      directions: [],
    };
  }

  compile(song: Readonly<Song>): CompiledSong {
    const state = new CompilerState();

    // Pass 1: build frame timeline
    for (let measureIndex = 0; measureIndex < song.measures.length; measureIndex++) {
      this.compileMeasure(state, song.measures[measureIndex]!, measureIndex);
    }

    this.compileMeasure(state, Compiler.stopMeasure(), song.measures.length);

    // Pass 2: compile structural directions
    for (let measureIndex = 0; measureIndex < song.measures.length; measureIndex++) {
      const measure = song.measures[measureIndex]!;
      for (const direction of measure.directions) {
        this.compileMeasureDirection(state, direction, measureIndex);
      }
    }

    if (state.measureFrameIndices.length !== song.measures.length + 1) {
      throw new CompilerStateError(`Invalid measureFrameIndices.length: ${state.measureFrameIndices.length}`);
    }

    return new CompiledSong(song, state.frames, state.markers, state.cuts, state.repeats);
  }

  private compileMeasure(state: CompilerState, measure: Readonly<Measure>, measureIndex: number): void {
    if (measure.beats.length === 0) {
      throw new SongStructureError(`Measure must contain at least one beat.`, measureIndex);
    }

    if (state.measureFrameIndices.length !== measureIndex) {
      throw new CompilerStateError(`measureFrameIndices.length (${state.measureFrameIndices.length}) should match measureIndex (${measureIndex})`);
    }

    state.measureFrameIndices.push(state.frameIndex);

    const measureFrameIndex = state.frameIndex;
    const measureBeats = measure.beats.length;

    for (const direction of measure.directions) {
      if (direction.type === "measureNumberChange") {
        state.measureNumber = asNumbering(direction.value);
      }
    }

    for (let beatIndex = 0; beatIndex < measure.beats.length; beatIndex++) {
      this.compileBeat(state, measure.beats[beatIndex]!, measureIndex, beatIndex, measureFrameIndex, measureBeats);
    }

    state.measureNumber = nextSequentialNumbering(state.measureNumber);
  }

  private compileBeat(
    state: CompilerState,
    beat: Readonly<Beat>,
    measureIndex: number,
    beatIndex: number,
    measureFrameIndex: number,
    measureBeats: number,
  ): void {
    for (const direction of beat.directions) {
      switch (direction.type) {
        case "tempoChange":
          state.tempo = direction.value;
          break;
        case "timeSignatureChange":
          state.timeSignature = direction.value;
          break;
        default:
          throw new SongStructureError(`Invalid direction type: ${(direction as BeatDirection).type}`, measureIndex, beatIndex);
      }
    }

    const duration = 60 / state.tempo.bpm;

    state.frames.push(new Frame(
      state.frameIndex++,
      measureIndex,
      beatIndex,
      state.measureNumber,
      measureFrameIndex,
      measureBeats,
      state.time,
      duration,
      state.tempo,
      state.timeSignature,
    ));

    state.time += duration;
  }

  private compileMeasureDirection(state: CompilerState, direction: Readonly<MeasureDirection>, measureIndex: number): void {
    const inFrame = state.getFrameByMeasureIndex(measureIndex);
    const outFrame = state.getFrameByMeasureIndex(measureIndex + (direction.length ?? 1));

    switch (direction.type) {
      case "measureNumberChange":
        break; // Handled in pass 1.
      case "marker":
        this.compileMarkerDirection(state, inFrame, outFrame, direction);
        break;
      case "cut":
        this.compileCutDirection(state, inFrame, outFrame, direction);
        break;
      case "repeat":
        this.compileRepeatDirection(state, inFrame, outFrame, direction);
        break;
    }
  }

  private forFrameRange(frames: Frame[], inFrame: Frame, outFrame: Frame, fn: (frame: Frame) => void): void {
    for (let i = inFrame.index; i < outFrame.index; i++) {
      fn(frames[i]!);
    }
  }

  private compileMarkerDirection(state: CompilerState, inFrame: Frame, outFrame: Frame, direction: MarkerDirection): void {
    const marker = new Marker(inFrame.index, direction);

    this.forFrameRange(state.frames, inFrame, outFrame, (frame) => {
      frame.marker = marker;
    });

    state.markers.push(marker);
  }

  private compileCutDirection(state: CompilerState, inFrame: Frame, outFrame: Frame, direction: CutDirection): void {
    const cut = new Cut(inFrame.index, outFrame.index, direction);

    this.forFrameRange(state.frames, inFrame, outFrame, (frame) => {
      if (frame.cut !== undefined) {
        throw new SongStructureError("Overlapping cuts.");
      }

      if (frame.repeat !== undefined) {
        throw new SongStructureError("Overlapping cut and repeat.");
      }

      frame.cut = cut;
    });

    inFrame.jumps.push(cut.createJump(state.cuts.length));
    state.cuts.push(cut);
  }

  private compileRepeatDirection(state: CompilerState, inFrame: Frame, outFrame: Frame, direction: RepeatDirection): void {
    const repeat = new Repeat(inFrame.index, outFrame.index, direction);

    this.forFrameRange(state.frames, inFrame, outFrame, (frame) => {
      if (frame.repeat !== undefined) {
        throw new SongStructureError("Overlapping repeats.");
      }

      if (frame.cut !== undefined) {
        throw new SongStructureError("Overlapping repeat and cut.");
      }

      if (repeat.isVampExit(inFrame.measureIndex, frame.measureIndex, frame.beatIndex)) {
        frame.jumps.push(repeat.createVampExitJump(state.repeats.length));
      }

      frame.repeat = repeat;
    });

    outFrame.jumps.push(repeat.createRepeatJump(state.repeats.length));
    state.repeats.push(repeat);
  }
}

export function compile(song: Song): CompiledSong {
  return new Compiler().compile(song);
}
