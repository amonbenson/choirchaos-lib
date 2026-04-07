import { type Beat } from "@/model/beat";
import { type BeatDirection, type MeasureDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, nextSequentialNumbering, type Numbering, type Tempo, type TimeSignature } from "@/music";

import CompiledBeat from "./beat";
import Cut from "./cut";
import { SongStructureError } from "./errors";
import { type Jump } from "./jump";
import Marker from "./marker";
import CompiledMeasure from "./measure";
import Repeat from "./repeat";
import CompiledSong from "./song";

type CompilerState = {
  time: number;
  measureNumber: Numbering;
  tempo: Tempo;
  timeSignature: TimeSignature;

  markers: Marker[];
  repeats: Repeat[];
  cuts: Cut[];
};

type CompilerFlags = {
  markerActive: boolean;
  repeatActive: boolean;
  repeatIn: boolean;
  repeatOut: boolean;
  cutActive: boolean;
  cutIn: boolean;
};

export default class Compiler {
  // Carry-forward state
  private state: CompilerState = Compiler.initialState();

  // Accumulated direction collections

  // Per-measure flags
  private flags: CompilerFlags = Compiler.initialFlags();

  private static initialState(): CompilerState {
    return {
      time: 0,
      measureNumber: asNumbering("1"),
      tempo: DefaultTempo,
      timeSignature: DefaultTimeSignature,

      markers: [],
      repeats: [],
      cuts: [],
    };
  }

  private static initialFlags(): CompilerFlags {
    return {
      markerActive: false,
      repeatActive: false,
      repeatIn: false,
      repeatOut: false,
      cutActive: false,
      cutIn: false,
    };
  }

  private static stopMeasure(): Measure {
    return {
      beats: [{ directions: [] }],
      directions: [],
    };
  }

  compile(song: Song): CompiledSong {
    this.state = Compiler.initialState();
    this.flags = Compiler.initialFlags();

    const compiledMeasures: CompiledMeasure[] = [];

    for (let measureIndex = 0; measureIndex < song.measures.length + 1; measureIndex++) {
      const measure = song.measures[measureIndex] ?? Compiler.stopMeasure();

      compiledMeasures.push(this.compileMeasure(measure, measureIndex));
    }

    if (this.flags.cutActive) {
      throw new SongStructureError("Cut cannot last past the length of the song.");
    }

    if (this.flags.repeatActive) {
      throw new SongStructureError("Repeat cannot last past the length of the song.");
    }

    return new CompiledSong(song, compiledMeasures, this.state.markers, this.state.cuts, this.state.repeats);
  }

  private compileMeasure(measure: Measure, measureIndex: number): CompiledMeasure {
    if (measure.beats.length === 0) {
      throw new SongStructureError("Measure must contain at least one beat.", measureIndex);
    }

    // Reset transient flags
    this.flags.markerActive = false;
    this.flags.repeatIn = false;
    this.flags.repeatOut = false;
    this.flags.cutIn = false;

    // Expire directions from the previous measure
    if (this.flags.repeatActive && this.state.repeats[this.state.repeats.length - 1].outMeasureIndex === measureIndex) {
      this.flags.repeatActive = false;
      this.flags.repeatOut = true;
    }

    if (this.flags.cutActive && this.state.cuts[this.state.cuts.length - 1].outMeasureIndex === measureIndex) {
      this.flags.cutActive = false;
    }

    // Process measure-level directions
    for (const direction of measure.directions) {
      switch (direction.type) {
        case "measureNumberChange":
          this.state.measureNumber = direction.value;
          break;
        case "marker":
          this.state.markers.push(new Marker(measureIndex, direction));
          this.flags.markerActive = true;
          break;
        case "repeat":
          if (this.flags.repeatActive) {
            throw new SongStructureError("Overlapping repeats.", measureIndex);
          }

          this.state.repeats.push(new Repeat(measureIndex, measureIndex + direction.length, direction));
          this.flags.repeatActive = true;
          this.flags.repeatIn = true;
          break;
        case "cut":
          if (this.flags.cutActive) {
            throw new SongStructureError("Overlapping cuts.", measureIndex);
          }

          this.state.cuts.push(new Cut(measureIndex, measureIndex + direction.length, direction));
          this.flags.cutActive = true;
          this.flags.cutIn = true;
          break;
        default:
          throw new SongStructureError(`Invalid direction type: ${(direction as MeasureDirection).type}`, measureIndex);
      }
    }

    if (this.flags.repeatActive && this.flags.cutActive) {
      throw new SongStructureError("Overlapping repeat and cut. This is not supported.", measureIndex);
    }

    // Compile beats
    const measureTime = this.state.time;
    let measureDuration = 0;
    const compiledBeats: CompiledBeat[] = [];

    for (let beatIndex = 0; beatIndex < measure.beats.length; beatIndex++) {
      const compiledBeat = this.compileBeat(measure.beats[beatIndex], measureIndex, beatIndex);

      measureDuration += compiledBeat.duration;
      compiledBeats.push(compiledBeat);
    }

    if (measureDuration <= 0) {
      throw new SongStructureError("Measure cannot have a negative duration. This is likely a tempo change issue.", measureIndex);
    }

    const compiledMeasure = new CompiledMeasure(
      measureIndex,
      this.state.measureNumber,
      measure,
      compiledBeats,
      measureTime,
      measureDuration,
      this.flags.markerActive ? this.state.markers[this.state.markers.length - 1] : undefined,
      this.flags.repeatActive ? this.state.repeats[this.state.repeats.length - 1] : undefined,
      this.flags.cutActive ? this.state.cuts[this.state.cuts.length - 1] : undefined,
    );

    this.state.measureNumber = nextSequentialNumbering(this.state.measureNumber);

    return compiledMeasure;
  }

  private compileBeat(beat: Beat, measureIndex: number, beatIndex: number): CompiledBeat {
    // Process beat-level directions
    for (const direction of beat.directions) {
      switch (direction.type) {
        case "tempoChange":
          if (direction.value.bpm <= 0) {
            throw new SongStructureError(`Invalid tempo BPM: ${direction.value.bpm}`, measureIndex, beatIndex);
          }

          this.state.tempo = direction.value;
          break;
        case "timeSignatureChange":
          if (direction.value.beats <= 0) {
            throw new SongStructureError(`Invalid time signature beats: ${direction.value.beats}`, measureIndex, beatIndex);
          }

          this.state.timeSignature = direction.value;
          break;
        default:
          throw new SongStructureError(`Invalid direction type: ${(direction as BeatDirection).type}`, measureIndex, beatIndex);
      }
    }

    const beatDuration = 60 / this.state.tempo.bpm;
    const jumps = this.generateJumps(measureIndex, beatIndex);

    const compiledBeat = new CompiledBeat(
      { measure: measureIndex, beat: beatIndex },
      beat,
      this.state.time,
      beatDuration,
      this.state.tempo,
      this.state.timeSignature,
      jumps,
    );

    this.state.time += beatDuration;

    return compiledBeat;
  }

  private generateJumps(measureIndex: number, beatIndex: number): Jump[] {
    const jumps: Jump[] = [];

    if (beatIndex === 0) {
      if (this.flags.cutIn) {
        const cutIndex = this.state.cuts.length - 1;

        jumps.push(this.state.cuts[cutIndex].createJump(cutIndex));
      }

      if (this.flags.repeatOut) {
        const repeatIndex = this.state.repeats.length - 1;

        jumps.push(this.state.repeats[repeatIndex].createRepeatJump(repeatIndex));
      }
    }

    if (this.flags.repeatActive) {
      const repeatIndex = this.state.repeats.length - 1;
      const repeat = this.state.repeats[repeatIndex];

      if (repeat.isVampExit(measureIndex, beatIndex, this.flags.repeatIn)) {
        jumps.push(repeat.createVampExitJump(repeatIndex));
      }
    }

    return jumps;
  }
}

export function compile(song: Song): CompiledSong {
  return new Compiler().compile(song);
}
