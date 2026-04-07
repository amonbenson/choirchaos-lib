import { type BeatDirection, type MeasureDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, nextSequentialNumbering } from "@/music";

import CompiledBeat from "./beat";
import Cut from "./cut";
import { SongStructureError } from "./errors";
import { type Jump } from "./jump";
import Marker from "./marker";
import CompiledMeasure from "./measure";
import Repeat from "./repeat";
import CompiledSong from "./song";

function createFinalSourceMeasure(): Measure {
  return {
    beats: [{
      directions: [],
    }],
    directions: [],
  };
}

export function compile(song: Song): CompiledSong {
  const compiledMeasures: CompiledMeasure[] = [];

  const markers: Marker[] = [];
  const repeats: Repeat[] = [];
  const cuts: Cut[] = [];

  let time = 0;
  let measureNumber = asNumbering("1");

  let tempo = DefaultTempo;
  let timeSignature = DefaultTimeSignature;

  // Reset flags
  const flags = {
    markerActive: false,

    repeatActive: false,
    repeatIn: false,
    repeatOut: false,

    cutActive: false,
    cutIn: false,
    cutOut: false,
  };

  for (let measureIndex = 0; measureIndex < song.measures.length + 1; measureIndex++) {
    const measure = song.measures[measureIndex] ?? createFinalSourceMeasure();
    const compiledBeats: CompiledBeat[] = [];

    if (measure.beats.length === 0) {
      throw new SongStructureError("Measure must contain at least one beat.", measureIndex);
    }

    const measureTime = time;
    let measureDuration = 0;

    // Reset measure flags
    flags.repeatIn = false;
    flags.repeatOut = false;
    flags.cutIn = false;
    flags.cutOut = false;

    // Release previous measure-level directions
    if (flags.markerActive) {
      flags.markerActive = false;
    }

    if (flags.repeatActive && repeats[repeats.length - 1].outMeasureIndex === measureIndex) {
      flags.repeatActive = false;
      flags.repeatOut = true;
    }

    if (flags.cutActive && cuts[cuts.length - 1].outMeasureIndex === measureIndex) {
      flags.cutActive = false;
      flags.cutOut = true;
    }

    // Handle measure-level directions
    for (const direction of measure.directions) {
      switch (direction.type) {
        case "measureNumberChange":
          measureNumber = direction.value;
          break;
        case "marker":
          markers.push(new Marker(measureIndex, direction));
          flags.markerActive = true;
          break;
        case "repeat":
          if (flags.repeatActive) {
            throw new SongStructureError("Overlapping repeats.", measureIndex);
          }

          repeats.push(new Repeat(measureIndex, measureIndex + direction.length, direction));
          flags.repeatActive = true;
          flags.repeatIn = true;
          break;
        case "cut":
          if (flags.cutActive) {
            throw new SongStructureError("Overlapping cuts.", measureIndex);
          }

          cuts.push(new Cut(measureIndex, measureIndex + direction.length, direction));
          flags.cutActive = true;
          flags.cutIn = true;
          break;
        default:
          throw new SongStructureError(`Invalid direction type: ${(direction as MeasureDirection).type}`, measureIndex);
      }
    }

    // Validate flags
    if (flags.repeatActive && flags.cutActive) {
      throw new SongStructureError("Overlapping repeat and cut. This is not supported.", measureIndex);
    }

    // Handle each beat
    for (let beatIndex = 0; beatIndex < measure.beats.length; beatIndex++) {
      const beat = measure.beats[beatIndex];

      // Handle beat-level directions: Keep track of tempo and time signature changes
      for (const direction of beat.directions) {
        switch (direction.type) {
          case "tempoChange":
            if (direction.value.bpm <= 0) {
              throw new SongStructureError(`Invalid tempo BPM: ${direction.value.bpm}`, measureIndex, beatIndex);
            }

            tempo = direction.value;
            break;
          case "timeSignatureChange":
            if (direction.value.beats <= 0) {
              throw new SongStructureError(`Invalid time signature beats: ${direction.value.beats}`, measureIndex, beatIndex);
            }

            timeSignature = direction.value;
            break;
          default:
            throw new SongStructureError(`Invalid direction type: ${(direction as BeatDirection).type}`, measureIndex, beatIndex);
        }
      }

      // Calculate the beat duration using the tempo and accumulate the measure duration
      const beatDuration = 60 / tempo.bpm;
      measureDuration += beatDuration;

      // Generate jumps
      const jumps: Jump[] = [];

      if (beatIndex === 0) {
        if (flags.cutIn) {
          // Add jump from cut in to cut out
          const cutIndex = cuts.length - 1;
          jumps.push({
            type: "cut",
            targetIndex: {
              measure: cuts[cutIndex].outMeasureIndex,
              beat: 0,
            },
            cutIndex,
          });
        }

        if (flags.repeatOut) {
          // Add jump from repeat out to repeat in
          const repeatIndex = repeats.length - 1;
          jumps.push({
            type: "repeat",
            targetIndex: {
              measure: repeats[repeatIndex].inMeasureIndex,
              beat: 0,
            },
            repeatIndex,
          });
        }
      }

      if (flags.repeatActive) {
        const repeatIndex = repeats.length - 1;
        const repeat = repeats[repeatIndex];
        const repeatExit = repeat.sourceDirection.exit;

        if (repeatExit.type !== "count") {
          const measuresIntoVamp = measureIndex - repeat.inMeasureIndex;
          let exitPoint = false;

          switch (repeatExit.type) {
            case "vamp":
              exitPoint = flags.repeatIn && beatIndex === 0;
              break;
            case "vampOutAnyBar":
              exitPoint = beatIndex === 0 && measuresIntoVamp % repeatExit.every === 0;
              break;
            case "vampOutAnyBeat":
              exitPoint = beatIndex % repeatExit.every === 0;
              break;
            default:
              break;
          }

          if (exitPoint) {
            jumps.push({
              type: "vampExit",
              targetIndex: {
                measure: repeat.outMeasureIndex,
                beat: 0,
              },
              repeatIndex,
            });
          }
        }
      }

      // Compile and insert a new beat
      compiledBeats.push(new CompiledBeat(
        { measure: measureIndex, beat: beatIndex },
        beat,
        time,
        beatDuration,
        tempo,
        timeSignature,
        jumps,
      ));

      // Increment the time pointer
      time += beatDuration;
    }

    if (measureDuration <= 0) {
      throw new SongStructureError("Measure cannot have a negative duration. This is likely a tempo change issue.", measureIndex);
    }

    compiledMeasures.push(new CompiledMeasure(
      measureIndex,
      measureNumber,
      measure,
      compiledBeats,
      measureTime,
      measureDuration,
      flags.markerActive ? markers[markers.length - 1] : undefined,
      flags.repeatActive ? repeats[repeats.length - 1] : undefined,
      flags.cutActive ? cuts[cuts.length - 1] : undefined,
    ));

    measureNumber = nextSequentialNumbering(measureNumber);
  }

  // Make sure no cuts or repeats exist past the end of the song
  if (flags.cutActive) {
    throw new SongStructureError("Cut cannot last past the length of the song.");
  }

  if (flags.repeatActive) {
    throw new SongStructureError("Repeat cannot last past the length of the song.");
  }

  return new CompiledSong(
    song,
    compiledMeasures,
    markers,
    cuts,
    repeats,
  );
}
