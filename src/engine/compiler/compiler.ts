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
};

export default class Compiler {
  // Carry-forward state
  private state: CompilerState = Compiler.initialState();

  // Accumulated direction collections
  private readonly markers: Marker[] = [];
  private readonly repeats: Repeat[] = [];
  private readonly cuts: Cut[] = [];

  // Transient per-measure flags
  private markerActive = false;
  private repeatActive = false;
  private repeatIn = false;
  private repeatOut = false;
  private cutActive = false;
  private cutIn = false;

  private static initialState(): CompilerState {
    return {
      time: 0,
      measureNumber: asNumbering("1"),
      tempo: DefaultTempo,
      timeSignature: DefaultTimeSignature,
    };
  }

  private static stopMeasure(): Measure {
    return {
      beats: [{ directions: [] }],
      directions: [],
    };
  }

  compile(song: Song): CompiledSong {
    const compiledMeasures: CompiledMeasure[] = [];

    for (let measureIndex = 0; measureIndex < song.measures.length + 1; measureIndex++) {
      const measure = song.measures[measureIndex] ?? Compiler.stopMeasure();

      compiledMeasures.push(this.compileMeasure(measure, measureIndex));
    }

    if (this.cutActive) {
      throw new SongStructureError("Cut cannot last past the length of the song.");
    }

    if (this.repeatActive) {
      throw new SongStructureError("Repeat cannot last past the length of the song.");
    }

    return new CompiledSong(song, compiledMeasures, this.markers, this.cuts, this.repeats);
  }

  private compileMeasure(measure: Measure, measureIndex: number): CompiledMeasure {
    if (measure.beats.length === 0) {
      throw new SongStructureError("Measure must contain at least one beat.", measureIndex);
    }

    // Reset transient flags
    this.markerActive = false;
    this.repeatIn = false;
    this.repeatOut = false;
    this.cutIn = false;

    // Expire directions from the previous measure
    if (this.repeatActive && this.repeats[this.repeats.length - 1].outMeasureIndex === measureIndex) {
      this.repeatActive = false;
      this.repeatOut = true;
    }

    if (this.cutActive && this.cuts[this.cuts.length - 1].outMeasureIndex === measureIndex) {
      this.cutActive = false;
    }

    // Process measure-level directions
    for (const direction of measure.directions) {
      switch (direction.type) {
        case "measureNumberChange":
          this.state.measureNumber = direction.value;
          break;
        case "marker":
          this.markers.push(new Marker(measureIndex, direction));
          this.markerActive = true;
          break;
        case "repeat":
          if (this.repeatActive) {
            throw new SongStructureError("Overlapping repeats.", measureIndex);
          }

          this.repeats.push(new Repeat(measureIndex, measureIndex + direction.length, direction));
          this.repeatActive = true;
          this.repeatIn = true;
          break;
        case "cut":
          if (this.cutActive) {
            throw new SongStructureError("Overlapping cuts.", measureIndex);
          }

          this.cuts.push(new Cut(measureIndex, measureIndex + direction.length, direction));
          this.cutActive = true;
          this.cutIn = true;
          break;
        default:
          throw new SongStructureError(`Invalid direction type: ${(direction as MeasureDirection).type}`, measureIndex);
      }
    }

    if (this.repeatActive && this.cutActive) {
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
      this.markerActive ? this.markers[this.markers.length - 1] : undefined,
      this.repeatActive ? this.repeats[this.repeats.length - 1] : undefined,
      this.cutActive ? this.cuts[this.cuts.length - 1] : undefined,
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
      if (this.cutIn) {
        const cutIndex = this.cuts.length - 1;

        jumps.push(this.cuts[cutIndex].createJump(cutIndex));
      }

      if (this.repeatOut) {
        const repeatIndex = this.repeats.length - 1;

        jumps.push(this.repeats[repeatIndex].createRepeatJump(repeatIndex));
      }
    }

    if (this.repeatActive) {
      const repeatIndex = this.repeats.length - 1;
      const repeat = this.repeats[repeatIndex];

      if (repeat.isVampExit(measureIndex, beatIndex, this.repeatIn)) {
        jumps.push(repeat.createVampExitJump(repeatIndex));
      }
    }

    return jumps;
  }
}

export function compile(song: Song): CompiledSong {
  return new Compiler().compile(song);
}
