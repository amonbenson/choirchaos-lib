import { type Beat } from "@/model/beat";
import { type BeatDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, nextSequentialNumbering, type Numbering, type Tempo, type TimeSignature } from "@/music";

import CompiledSong from "./compiledSong";
import type Cut from "./cut";
import { CompilerStateError, SongStructureError } from "./errors";
import Frame from "./frame";
import type Marker from "./marker";
import type Repeat from "./repeat";

// Type CompilerFlags = {
//   markerActive: boolean;

//   repeatRemainingMeasures: number;
//   repeatIn: boolean;
//   repeatOut: boolean;

//   cutRemainingMeasures: number;
//   cutIn: boolean;
// };

// type CompilerState = {
//   frames: Frame[];
//   markers: Marker[];
//   repeats: Repeat[];
//   cuts: Cut[];

//   frameIndex: number;
//   measureIndex: number;
//   beatIndex: number;

//   time: number;
//   measureNumber: Numbering;
//   tempo: Tempo;
//   timeSignature: TimeSignature;

//   flags: CompilerFlags;
// };

export class CompilerState {
  constructor(
    public frames: Frame[] = [],
    public measureFrameIndices: number[] = [],

    public markers: Marker[] = [],
    public repeats: Repeat[] = [],
    public cuts: Cut[] = [],

    public frameIndex: number = 0,
    public measureIndex: number = 0,
    public beatIndex: number = 0,

    public measureFrameIndex: number = 0,
    public measureBeats: number = 0,
    public measureNumber: Numbering = asNumbering("1"),

    public time: number = 0,
    public tempo: Tempo = DefaultTempo,
    public timeSignature: TimeSignature = DefaultTimeSignature,
  ) {}
}

export default class Compiler {
  private static stopMeasure(): Measure {
    return {
      beats: [
        {
          directions: [],
        },
      ],
      directions: [],
    };
  }

  compile(song: Readonly<Song>): CompiledSong {
    const state = new CompilerState();

    // Compile frames for each measure
    for (state.measureIndex = 0; state.measureIndex < song.measures.length; state.measureIndex++) {
      const measure = song.measures[state.measureIndex];
      this.compileMeasure(state, measure);
    }

    // Insert stop measure
    this.compileMeasure(state, Compiler.stopMeasure());

    // If (state.flags.cutRemainingMeasures > 0) {
    //   throw new SongStructureError("Cut cannot last past the length of the song.");
    // }

    // if (state.flags.repeatRemainingMeasures > 0) {
    //   throw new SongStructureError("Repeat cannot last past the length of the song.");
    // }

    return new CompiledSong(
      song,
      state.frames,
      state.markers,
      state.cuts,
      state.repeats,
    );
  }

  compileMeasure(state: CompilerState, measure: Measure): void {
    // Validate and store measure state information
    if (measure.beats.length === 0) {
      throw new SongStructureError(`Measure must contain at least one beat.`, state.measureIndex);
    }

    if (state.measureFrameIndices.length !== state.measureIndex) {
      throw new CompilerStateError(`Out of sync: frame indices length (${state.measureFrameIndices.length}) should match measure index (${state.measureIndex})`);
    }

    state.measureFrameIndices.push(state.frameIndex);
    state.measureFrameIndex = state.frameIndex;
    state.measureBeats = measure.beats.length;

    // Handle measure-number changes
    for (const direction of measure.directions) {
      switch (direction.type) {
        case "measureNumberChange":
          state.measureNumber = asNumbering(direction.value);
          break;
        default:
          break;
      }
    }

    // Compile each beat into a separate frame
    for (state.beatIndex = 0; state.beatIndex < measure.beats.length; state.beatIndex++) {
      const beat = measure.beats[state.beatIndex];
      this.compileBeat(state, beat);
    }

    // Increment automatic measure numbering
    state.measureNumber = nextSequentialNumbering(state.measureNumber);
  }

  compileBeat(state: CompilerState, beat: Beat): void {
    // Handle beat-level directions (tempo and time signature changes)
    for (const direction of beat.directions) {
      switch (direction.type) {
        case "tempoChange":
          state.tempo = direction.value;
          break;
        case "timeSignatureChange":
          state.timeSignature = direction.value;
          break;
        default:
          throw new SongStructureError(`Invalid direction type: ${(direction as BeatDirection).type}`, state.measureIndex, state.beatIndex);
      }
    }

    // Calculate beat duration using the current bpm
    const duration = 60 / state.tempo.bpm;

    // Create a frame for this beat
    const frame = new Frame(
      state.frameIndex++,
      state.measureIndex,
      state.beatIndex,
      state.measureNumber,
      state.measureFrameIndex,
      state.measureBeats,
      state.time,
      duration,
      state.tempo,
      state.timeSignature,
    );

    state.frames.push(frame);

    // Update time
    state.time += duration;
  }

  // Private compileMeasure(state: CompilerState, measure: Readonly<Measure>): Frame[] {
  //   if (measure.beats.length === 0) {
  //     throw new SongStructureError("Measure must contain at least one beat.", state.measureIndex);
  //   }

  //   // Reset transient flags
  //   state.flags.markerActive = false;
  //   state.flags.repeatIn = false;
  //   state.flags.repeatOut = false;
  //   state.flags.cutIn = false;

  //   // Update remaining measures of directions that span multiple measures (cuts and repeats)
  //   if (state.flags.repeatRemainingMeasures > 0) {
  //     state.flags.repeatRemainingMeasures--;

  //     // Mark the first measure after a repeat ended (the repeat-out-point)
  //     if (state.flags.repeatRemainingMeasures === 0) {
  //       state.flags.repeatOut = true;
  //     }
  //     // If (state.repeats[state.repeats.length - 1].outMeasureIndex === state.measureIndex) {
  //     //   state.flags.repeatOut = true;
  //     // }
  //   }

  //   if (state.flags.cutRemainingMeasures) {
  //     state.flags.cutRemainingMeasures--;

  //     // If (state.cuts[state.cuts.length - 1].outFrameIndex === state.frameIndex) {
  //     //   state.flags.cutActive = false;
  //     // }
  //   }

  //   // Process measure-level directions
  //   for (const direction of measure.directions) {
  //     switch (direction.type) {
  //       case "measureNumberChange":
  //         state.measureNumber = direction.value;
  //         break;
  //       case "marker":
  //         state.markers.push(new Marker(state.frameIndex, direction));
  //         state.flags.markerActive = true;
  //         break;
  //       case "repeat":
  //         if (state.flags.repeatRemainingMeasures > 0) {
  //           throw new SongStructureError("Overlapping repeats.", state.measureIndex);
  //         }

  //         state.repeats.push(new Repeat(state.frameIndex, measureIndex + direction.length, direction));
  //         state.flags.repeatActive = true;
  //         state.flags.repeatIn = true;
  //         break;
  //       case "cut":
  //         if (state.flags.cutActive) {
  //           throw new SongStructureError("Overlapping cuts.", measureIndex);
  //         }

  //         state.cuts.push(new Cut(measureIndex, measureIndex + direction.length, direction));
  //         state.flags.cutActive = true;
  //         state.flags.cutIn = true;
  //         break;
  //       default:
  //         throw new SongStructureError(`Invalid direction type: ${(direction as MeasureDirection).type}`, measureIndex);
  //     }
  //   }

  //   if (state.flags.repeatActive && state.flags.cutActive) {
  //     throw new SongStructureError("Overlapping repeat and cut. This is not supported.", measureIndex);
  //   }

  //   // Compile beats
  //   const measureTime = state.time;
  //   let measureDuration = 0;
  //   const compiledBeats: Frame[] = [];

  //   for (let beatIndex = 0; beatIndex < measure.beats.length; beatIndex++) {
  //     const compiledBeat = this.compileBeat(measure.beats[beatIndex], measureIndex, beatIndex);

  //     measureDuration += compiledBeat.duration;
  //     compiledBeats.push(compiledBeat);
  //   }

  //   if (measureDuration <= 0) {
  //     throw new SongStructureError("Measure cannot have a negative duration. This is likely a tempo change issue.", measureIndex);
  //   }

  //   const compiledMeasure = new CompiledMeasure(
  //     measureIndex,
  //     this.state.measureNumber,
  //     measure,
  //     compiledBeats,
  //     measureTime,
  //     measureDuration,
  //     this.flags.markerActive ? this.state.markers[this.state.markers.length - 1] : undefined,
  //     this.flags.repeatActive ? this.state.repeats[this.state.repeats.length - 1] : undefined,
  //     this.flags.cutActive ? this.state.cuts[this.state.cuts.length - 1] : undefined,
  //   );

  //   this.state.measureNumber = nextSequentialNumbering(this.state.measureNumber);

  //   return compiledMeasure;
  // }

  // private compileBeat(beat: Beat, measureIndex: number, beatIndex: number): Frame {
  //   // Process beat-level directions
  //   for (const direction of beat.directions) {
  //     switch (direction.type) {
  //       case "tempoChange":
  //         if (direction.value.bpm <= 0) {
  //           throw new SongStructureError(`Invalid tempo BPM: ${direction.value.bpm}`, measureIndex, beatIndex);
  //         }

  //         this.state.tempo = direction.value;
  //         break;
  //       case "timeSignatureChange":
  //         if (direction.value.beats <= 0) {
  //           throw new SongStructureError(`Invalid time signature beats: ${direction.value.beats}`, measureIndex, beatIndex);
  //         }

  //         this.state.timeSignature = direction.value;
  //         break;
  //       default:
  //         throw new SongStructureError(`Invalid direction type: ${(direction as BeatDirection).type}`, measureIndex, beatIndex);
  //     }
  //   }

  //   const beatDuration = 60 / this.state.tempo.bpm;
  //   const jumps = this.generateJumps(measureIndex, beatIndex);

  //   const compiledBeat = new Frame(
  //     { measure: measureIndex, beat: beatIndex },
  //     beat,
  //     this.state.time,
  //     beatDuration,
  //     this.state.tempo,
  //     this.state.timeSignature,
  //     jumps,
  //   );

  //   this.state.time += beatDuration;

  //   return compiledBeat;
  // }

  // private generateJumps(measureIndex: number, beatIndex: number): Jump[] {
  //   const jumps: Jump[] = [];

  //   if (beatIndex === 0) {
  //     if (this.flags.cutIn) {
  //       const cutIndex = this.state.cuts.length - 1;

  //       jumps.push(this.state.cuts[cutIndex].createJump(cutIndex));
  //     }

  //     if (this.flags.repeatOut) {
  //       const repeatIndex = this.state.repeats.length - 1;

  //       jumps.push(this.state.repeats[repeatIndex].createRepeatJump(repeatIndex));
  //     }
  //   }

  //   if (this.flags.repeatActive) {
  //     const repeatIndex = this.state.repeats.length - 1;
  //     const repeat = this.state.repeats[repeatIndex];

  //     if (repeat.isVampExit(measureIndex, beatIndex, this.flags.repeatIn)) {
  //       jumps.push(repeat.createVampExitJump(repeatIndex));
  //     }
  //   }

  //   return jumps;
  // }
}

export function compile(song: Song): CompiledSong {
  return new Compiler().compile(song);
}
