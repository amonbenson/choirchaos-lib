import { type Song } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, nextSequentialNumbering, Numbering } from "@/music";

import { type CompiledBeat, CompiledBeatList } from "./beat";
import { type Cut } from "./cut";
import { CompilerStateError } from "./errors";
import { type Jump } from "./jump";
import { type Repeat } from "./repeat";
import CompiledSong from "./song";

export default class Compiler {
  private song?: Song;
  private compiledSong?: CompiledSong;

  getSong(): Song {
    if (!this.song) {
      throw new CompilerStateError("No song loaded.");
    }

    return this.song;
  }

  getCompiledSong(): CompiledSong {
    if (!this.compiledSong) {
      throw new CompilerStateError("No song compiled.");
    }

    return this.compiledSong;
  }

  compile(song: Song): CompiledSong {
    this.song = song;

    const compiledBeats: CompiledBeat[] = [];

    let measureLabel = asNumbering("1");

    let tempo = DefaultTempo;
    let timeSignature = DefaultTimeSignature;

    // First pass: Generate compiled beats
    for (const measure of song.measures) {
      for (let beatIndex = 0; beatIndex < measure.beats.length; beatIndex++) {
        const beat = measure.beats[beatIndex];

        // Check for tempo or time signature changes
        for (const direction of beat.directions) {
          switch (direction.type) {
            case "tempoChange":
              tempo = direction.value;
              break;
            case "timeSignatureChange":
              timeSignature = direction.value;
              break;
            default:
              break;
          }
        }

        // Generate a new compiled beat
        compiledBeats.push({
          index: compiledBeats.length,
          label: {
            measure: measureLabel,
            beat: beatIndex,
          },
          timePosition: 0,
          timeDuration: 0,
          tempo,
          timeSignature,
        });
      }

      // Increate measure number
      measureLabel = nextSequentialNumbering(measureLabel);
    }

    // Second pass: Generate cuts and repeats
    let marker: string | undefined;
    const cut: Cut | undefined;
    const repeat: Repeat | undefined;
    const jump: Jump | undefined;

    const compiledBeatIndex = 0;
    for (const measure of song.measures) {
      const measureStartBeat = compiledBeats[compiledBeatIndex];

      for (const direction of measure.directions) {
        switch (direction.type) {
          case "marker":
            marker = direction.value;
            break;
          case "cut":
            cut = {
              in: compiledBeats[measureStartBeat],
            };
          case "repeat":
            repeat = {
              in: compiledBeats[measureStartBeat],
            };
        }
      }

      for (const beat of measure.beats) {
        const compiledBeat = compiledBeats[compiledBeatIndex++];
      }
    }

    // Third pass: Compute time
    let timePosition = 0;

    for (const compiledBeat of compiledBeats) {
      const timeDuration = 60 / compiledBeat.tempo.bpm;

      compiledBeat.timePosition = timePosition;
      compiledBeat.timeDuration = timeDuration;

      timePosition += timeDuration;
    }

    // Set and return the compiled song
    this.compiledSong = new CompiledSong(compiledBeats);
    return this.compiledSong;
  }
}
