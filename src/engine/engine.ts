import { type Cut, type Marker, type MeasureDirection, type Repeat, type Vamp } from "@/model/direction";
import { type MeasureNumber } from "@/model/measure";
import { type Song } from "@/model/song";
import { DefaultTempo, DefaultTimeSignature, nextSequentialNumbering } from "@/music";
import { Emitter, type Emitters } from "@/utils/events";

import { type BeatFrame, BeatTimeline } from "./beatFrame";
import { EngineStateError, SongStructureError } from "./errors";
import { type ResolvedDirection } from "./resolvedDirection";

export type EngineOptions = {
  markerDuration: "beat" | "bar";
};

export default class Engine {
  private readonly emitters = {
    unloaded: new Emitter<void>(),
    ready: new Emitter<void>(),
    error: new Emitter<Error>(),
  } satisfies Emitters;

  private options: EngineOptions;

  private song?: Song;

  private beats: BeatTimeline = new BeatTimeline();
  private currentBeatIndex: number = 0;

  readonly onUnloaded = this.emitters.unloaded.event;
  readonly onReady = this.emitters.ready.event;
  readonly onError = this.emitters.error.event;

  constructor(options: Partial<EngineOptions> = {}) {
    this.options = {
      markerDuration: "bar",
      ...options,
    };
  }

  public isReady(): boolean {
    return Boolean(this.song);
  }

  public getBeatFrames(): BeatFrame[] {
    return this.beats.items();
  }

  private generateBeatFrames(): void {
    if (!this.song) {
      throw new EngineStateError("Engine has no song stored.");
    }

    // Generate all annotated beats
    const beatFrames: BeatFrame[] = [];

    let time = 0;
    let measureNumber = "1" as MeasureNumber;

    let tempo = DefaultTempo;
    let timeSignature = DefaultTimeSignature;

    let marker: ResolvedDirection<Marker> | undefined = undefined;
    let repeat: ResolvedDirection<Repeat> | undefined = undefined;
    let vamp: ResolvedDirection<Vamp> | undefined = undefined;
    let cut: ResolvedDirection<Cut> | undefined = undefined;

    for (let m = 0; m < this.song.measures.length; m++) {
      const measure = this.song.measures[m];

      // Handle measure directions
      for (const direction of measure.directions) {
        // Catch overlapping repeats
        if ((repeat || vamp) && (direction.type === "repeat" || direction.type === "vamp")) {
          throw new SongStructureError(`Overlapping repeat or vamp at measure ${measureNumber}`, m);
        }

        const resolvedDirection = {
          ...direction,
          measureIndex: m,
        } satisfies ResolvedDirection<MeasureDirection>;

        switch (resolvedDirection.type) {
          case "measureNumberChange":
            measureNumber = resolvedDirection.value;
            break;
          case "marker":
            marker = resolvedDirection;
            break;
          case "repeat":
            if (resolvedDirection.length < 1) {
              throw new SongStructureError("Repeat length must be at least 1.", m);
            }

            if (resolvedDirection.iterations < 2) {
              throw new SongStructureError("Repeat must have at least 2 iterations.", m);
            }

            repeat = resolvedDirection;
            break;
          case "vamp":
            if (resolvedDirection.length < 1) {
              throw new SongStructureError("Vamp length must be at least 1.", m);
            }

            if (resolvedDirection.exit.type !== "end" && resolvedDirection.exit.every < 1) {
              throw new SongStructureError("Vamp exit interval must be at least 1.", m);
            }

            vamp = resolvedDirection;
            break;
          case "cut":
            if (resolvedDirection.length < 1) {
              throw new SongStructureError("Cut length must be at least 1.", m);
            }

            cut = resolvedDirection;
            break;
        }
      }

      for (let b = 0; b < measure.beats.length; b++) {
        const beat = measure.beats[b];

        // Handle beat directions
        for (const direction of beat.directions) {
          switch (direction.type) {
            case "tempoChange":
              if (!isFinite(direction.value.bpm) || direction.value.bpm <= 0) {
                throw new SongStructureError("Tempo BPM must be a positive finite number.", m);
              }

              tempo = direction.value;
              break;
            case "timeSignatureChange":
              if (direction.value.beats < 1) {
                throw new SongStructureError("Time signature beat count must be at least 1.", m);
              }

              timeSignature = direction.value;
              break;
          }
        }

        // Beat duration can be derived directly from the tempo in beats per second
        const duration = 60 / tempo.bpm;

        beatFrames.push({
          time,
          duration,
          reference: [measureNumber, b],
          tempo,
          timeSignature,
          marker,
          repeat,
          vamp,
          cut,
        });

        // Increment time
        time += duration;
      }

      // Increment the measure number
      measureNumber = nextSequentialNumbering(measureNumber);

      // Clear past directions
      if (marker) {
        marker = undefined;
      }

      if (repeat && m - repeat.measureIndex >= repeat.length) {
        repeat = undefined;
      }

      if (vamp && m - vamp.measureIndex >= vamp.length) {
        vamp = undefined;
      }

      if (cut && m - cut.measureIndex >= cut.length) {
        cut = undefined;
      }
    }

    // Make sure that all length-restricted directions persist past the end of the song
    if (repeat) {
      throw new SongStructureError("Repeat cannot persist past the end of the song.", repeat.measureIndex);
    }

    if (vamp) {
      throw new SongStructureError("Vamp cannot persist past the end of the song.", vamp.measureIndex);
    }

    if (cut) {
      throw new SongStructureError("Cut cannot persist past the end of the song.", cut.measureIndex);
    }

    // Store the annotated beats and reset the index
    this.beats = new BeatTimeline(beatFrames);
    this.currentBeatIndex = 0;
  }

  private reset(): void {
    this.song = undefined;
    this.beats.clear();
    this.currentBeatIndex = 0;
  }

  load(song: Song): void {
    // Unload previous song
    if (this.isReady()) {
      this.unload();
    }

    try {
      this.song = song;

      this.generateBeatFrames();
      this.currentBeatIndex = 0;

      this.emitters.ready.fire();
    } catch (err) {
      this.reset();
      this.emitters.error.fire(err as Error);
    }
  }

  unload(): void {
    // Skip if song has already been unloaded
    if (!this.isReady()) {
      return;
    }

    this.reset();
    this.emitters.unloaded.fire();
  }
}
