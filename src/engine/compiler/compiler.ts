import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, nextSequentialNumbering } from "@/music";

import CompiledBeat from "./beat";
import { SongStructureError } from "./errors";
import CompiledMeasure from "./measure";
import { type MeasureBeatIndex } from "./measureBeatIndex";
import CompiledSong from "./song";

export function compile(song: Song): CompiledSong {
  const compiledMeasures: CompiledMeasure[] = [];

  let time = 0;
  let measureNumber = asNumbering("1");

  let tempo = DefaultTempo;
  let timeSignature = DefaultTimeSignature;

  for (let measureIndex = 0; measureIndex < song.measures.length; measureIndex++) {
    const measure = song.measures[measureIndex];
    const compiledBeats: CompiledBeat[] = [];

    if (measure.beats.length === 0) {
      throw new SongStructureError("Measure must contain at least one beat.", measureIndex);
    }

    const measureTime = time;
    let measureDuration = 0;

    for (let beatIndex = 0; beatIndex < measure.beats.length; beatIndex++) {
      const beat = measure.beats[beatIndex];

      // Keep track of tempo and time signature changes
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
            break;
        }
      }

      // Calculate the beat duration using the tempo and accumulate the measure duration
      const beatDuration = 60 / tempo.bpm;
      measureDuration += beatDuration;

      if (beatDuration <= 0) {
        throw new SongStructureError("Beat cannot have a negative duration. This is likely a tempo change issue.", measureIndex, beatIndex);
      }

      // Compile and insert a new beat
      compiledBeats.push(new CompiledBeat(
        { measure: measureIndex, beat: beatIndex },
        beat,
        time,
        beatDuration,
        tempo,
        timeSignature,
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
    ));

    measureNumber = nextSequentialNumbering(measureNumber);
  }

  return new CompiledSong(song, compiledMeasures);
}
