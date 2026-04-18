import { EngineStateError } from "@/engine/errors";
import type Transport from "@/engine/transport";
import { type Location, type Region } from "@/engine/transport";
import { type MidiFileContents } from "@/model/fileContents";
import { type MidiMedia } from "@/model/track";
import { BinarySortedList } from "@/utils/binarySearch";
import WarpCurve from "@/utils/warpCurve";

import ChannelSource from "./base";

type NoteEvent = {
  tick: number;
  duration: number;
  pitch: number;
  velocity: number;
  program: number;
};

export default class MidiChannelSource extends ChannelSource<MidiMedia> {
  warpCurve: WarpCurve;
  notes: BinarySortedList<NoteEvent>;

  constructor(
    audioContext: AudioContext,
    transport: Transport,
    trackIndex: number,
    trackMedia: MidiMedia,
  ) {
    super(audioContext, transport, trackIndex, trackMedia);

    // Get the midi data from the file
    const midiFiles: MidiFileContents[] = this.compiledSong.source.files.filter(file => file.type === "mid");
    const file = midiFiles.find(file => file.id === this.trackMedia.fileId && file.type === "mid");
    if (!file) {
      throw new EngineStateError(`Midi file with id ${this.trackMedia.fileId} was not found.`);
    }

    // Set the warp curve
    this.warpCurve = new WarpCurve(file.syncInfo.warpPoints);

    // Extract all note events
    const notes: NoteEvent[] = [];

    for (const midiTrack of file.midiData.tracks) {
      const noteOnIndices = new Int32Array(128).fill(-1);

      let tick = 0;
      let program = 0;

      // Skip tracks that should not be included
      const trackName = midiTrack.find(event => event.type === "trackName")?.text;
      if (!trackName || !this.trackMedia.midiTrackNames.includes(trackName)) {
        continue;
      }

      // Go through all events and store the notes
      for (let eventIndex = 0; eventIndex < midiTrack.length; eventIndex++) {
        const event = midiTrack[eventIndex];
        tick += event.deltaTime;

        switch (event.type) {
          case "programChange":
            program = event.programNumber;
            break;
          case "noteOn":
            // Create a new note event. Leave the duration at 0, it will be set as soon as we encounter the note off
            noteOnIndices[event.noteNumber] = notes.length;
            notes.push({
              tick,
              duration: 0,
              pitch: event.noteNumber,
              velocity: event.velocity,
              program,
            });
            break;
          case "noteOff":
            // Lookup the corresponding note event
            const noteOnIndex = noteOnIndices[event.noteNumber];
            if (noteOnIndex === -1) {
              console.warn("Midi data contains note off without a note on.");
              break;
            }

            // Set the event's duration
            const noteEvent = notes[noteOnIndex];
            noteEvent.duration = tick - noteEvent.tick;

            // Clear the note on index
            noteOnIndices[event.noteNumber] = -1;
            break;
          default:
            break;
        }
      }

      if (noteOnIndices.some(index => index !== -1)) {
        console.warn("Some notes were never released (missing note off).");
      }
    }

    // Store the notes in a sorted list
    this.notes = new BinarySortedList(notes, {
      comparator: (a, b) => a.tick - b.tick,
    });
  }

  getOutputNode(): AudioNode {
    throw new Error("Method not implemented.");
  }

  dispose(): void {
    super.dispose();
  }

  protected handlePlay(): void {
  }

  protected handlePause(): void {
  }

  protected handleSeek(_location: Location): void {
  }

  protected handleRender(_region: Region): void {
  }
};
