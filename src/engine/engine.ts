import { type CutDirection, type MarkerDirection, type MeasureDirection, type RepeatDirection } from "@/model/direction";
import { type MeasureNumber } from "@/model/measure";
import { compareMeasureReferences, type MeasureReference } from "@/model/measureReference";
import { type Song } from "@/model/song";
import { DefaultTempo, DefaultTimeSignature, nextSequentialNumbering } from "@/music";
import { Emitter, type Emitters, Property } from "@/utils/events";
import { SetIntervalUpdater, type Updater } from "@/utils/updater";

import { type BeatFrame, BeatTimeline } from "./compiler/beat";
import { EngineStateError, SongStructureError } from "./errors";
import { type ResolvedDirection } from "./resolvedDirection";

export type RepeatState = {
  iteration: number;
  exiting: boolean;
};

export default class Engine {
  private readonly emitters = {
    unloaded: new Emitter<void>(),
    ready: new Emitter<void>(),
    error: new Emitter<Error>(),
  } satisfies Emitters;

  private updater: Updater;

  private song?: Song;
  private beatFrames = new BeatTimeline();

  private playing = new Property(false);
  private songTime = new Property(0);
  private songDuration = new Property(0);

  private currentBeatIndex = new Property(0);
  private currentBeat = new Property<BeatFrame | undefined>(undefined);
  private repeatState = new Property({
    iteration: 0,
    exiting: false,
  } as RepeatState);

  readonly onUnload = this.emitters.unloaded.event;
  readonly onReady = this.emitters.ready.event;
  readonly onError = this.emitters.error.event;

  readonly onPlayingChange = this.playing.onChange;
  readonly onSongTimeChange = this.songTime.onChange;
  readonly onSongDurationChange = this.songDuration.onChange;

  readonly onBeatChange = this.currentBeat.onChange;
  readonly onRepeatStateChange = this.repeatState.onChange;

  constructor(updater?: Updater) {
    // Set the updater or use the default internal one at 50 updates per second
    this.updater = updater ?? new SetIntervalUpdater({
      interval: 1 / 50,
      maximumLag: 5.0,
    });

    // Register updater callback
    this.updater.onTick((delta) => {
      if (this.isReady() && this.isPlaying()) {
        this.update(delta);
      }
    });

    // Link the current beat to the beat index
    this.currentBeatIndex.onChange((index) => {
      this.currentBeat.set(this.beatFrames.items()[index]);
    });
  }

  public isReady(): boolean {
    return Boolean(this.song);
  }

  public getSong(): Song | undefined {
    return this.song;
  }

  public getBeatFrames(): BeatFrame[] {
    return this.beatFrames.items();
  }

  public isPlaying(): boolean {
    return this.playing.get();
  }

  public getSongTime(): number {
    return this.songTime.get();
  }

  public getSongDuration(): number {
    return this.songDuration.get();
  }

  public getCurrentBeat(): BeatFrame | undefined {
    return this.currentBeat.get();
  }

  public getRepeatState(): RepeatState {
    return this.repeatState.get();
  }

  public setVampExiting(value: boolean): void {
    const beat = this.currentBeat.get();
    if (!beat) {
      throw new EngineStateError("No current beat.");
    }

    if (!beat.repeat) {
      throw new EngineStateError("Currently not repeating.");
    }

    if (beat.repeat.exit.type === "count") {
      throw new EngineStateError("Cannot exit counted repeat.");
    }

    this.repeatState.set({
      ...this.repeatState.get(),
      exiting: value,
    });
  }

  public getBeatByTime(time: number): BeatFrame | undefined {
    return this.beatFrames.search({ time } as BeatFrame);
  }

  public getBeatByMeasureReference(reference: MeasureReference): BeatFrame | undefined {
    return this.beatFrames.search({ reference } as BeatFrame, {
      comparator: (a, b) => compareMeasureReferences(a.reference, b.reference),
    });
  }

  private generateBeatFrames(): void {
    if (!this.song) {
      throw new EngineStateError("Engine has no song stored.");
    }

    // Generate all annotated beats
    const beatFrames: BeatFrame[] = [];

    let beatFrameIndex = 0;
    let time = 0;
    let measureNumber = "1" as MeasureNumber;

    let tempo = DefaultTempo;
    let timeSignature = DefaultTimeSignature;

    let marker: ResolvedDirection<MarkerDirection> | undefined = undefined;
    let repeat: ResolvedDirection<RepeatDirection> | undefined = undefined;
    let cut: ResolvedDirection<CutDirection> | undefined = undefined;

    for (let measureIndex = 0; measureIndex < this.song.measures.length; measureIndex++) {
      const measure = this.song.measures[measureIndex];

      // Clear directions
      if (marker) {
        marker = undefined;
      }

      if (repeat && measureIndex - beatFrames[repeat.beatFrameIndex].measureIndex >= repeat.length) {
        repeat = undefined;
      }

      if (cut && measureIndex - beatFrames[cut.beatFrameIndex].measureIndex >= cut.length) {
        cut = undefined;
      }

      if (measure.beats.length < 1) {
        throw new SongStructureError("Measure must contain at least one beat.", [measureNumber, 0]);
      }

      // Handle measure directions
      for (const direction of measure.directions) {
        // Catch overlapping repeats
        if (repeat && (direction.type === "repeat")) {
          throw new SongStructureError(`Overlapping repeat at measure ${measureNumber}`, [measureNumber, 0]);
        }

        const resolvedDirection = {
          ...direction,
          beatFrameIndex,
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
              throw new SongStructureError("Repeat length must be at least 1.", [measureNumber, 0]);
            }

            // Validate exit conditions for each type
            switch (resolvedDirection.exit.type) {
              case "count":
                if (resolvedDirection.exit.iterations < 1) {
                  throw new SongStructureError("Repeat must have at least 1 iterations.", [measureNumber, 0]);
                }

                break;
              case "vamp":
                break;
              case "vampOutAnyBar":
              case "vampOutAnyBeat":
                if (resolvedDirection.exit.every < 1) {
                  throw new SongStructureError("Vamp exit interval must be at least 1.", [measureNumber, 0]);
                }

                break;
            }

            repeat = resolvedDirection;
            break;
          case "cut":
            if (resolvedDirection.length < 1) {
              throw new SongStructureError("Cut length must be at least 1.", [measureNumber, 0]);
            }

            cut = resolvedDirection;
            break;
        }
      }

      for (let beatIndex = 0; beatIndex < measure.beats.length; beatIndex++) {
        const beat = measure.beats[beatIndex];

        // Handle beat directions
        for (const direction of beat.directions) {
          switch (direction.type) {
            case "tempoChange":
              if (!isFinite(direction.value.bpm) || direction.value.bpm <= 0) {
                throw new SongStructureError("Tempo BPM must be a positive finite number.", [measureNumber, 0]);
              }

              tempo = direction.value;
              break;
            case "timeSignatureChange":
              if (direction.value.beats < 1) {
                throw new SongStructureError("Time signature beat count must be at least 1.", [measureNumber, 0]);
              }

              timeSignature = direction.value;
              break;
          }
        }

        // // Check for vamp exit locations
        // if (repeat && repeat.exit.type !== "count") {
        //   switch (repeat.exit.type) {
        //     case "vampOutAnyBar":
        //       // Exit every nth bar on the first beat
        //       isVampExit = ((measureIndex - repeat.measureIndex) % repeat.exit.every) === 0 && beatIndex === 0;
        //       break;
        //     case "vampOutAnyBeat":
        //       // Exit every nth beat
        //       isVampExit = (beatIndex % repeat.exit.every) === 0;
        //       break;
        //     case "vamp":
        //       // Exit only at the end. This is handled by the clear-directions-block above
        //       break;
        //   }
        // }

        // Beat duration can be derived directly from the tempo in beats per second
        const duration = 60 / tempo.bpm;

        beatFrames.push({
          time,
          duration,
          reference: [measureNumber, beatIndex],
          measureIndex,
          tempo,
          timeSignature,
          marker,
          repeat,
          cut,
        });

        // Increment time and beat index
        time += duration;
        beatFrameIndex += 1;
      }

      // Increment the measure number
      measureNumber = nextSequentialNumbering(measureNumber);
    }

    // Make sure that all length-restricted directions persist past the end of the song
    if (repeat) {
      throw new SongStructureError("Repeat cannot persist past the end of the song.", beatFrames[repeat.beatFrameIndex].reference);
    }

    if (cut) {
      throw new SongStructureError("Cut cannot persist past the end of the song.", beatFrames[cut.beatFrameIndex].reference);
    }

    // Store all data
    this.beatFrames = new BeatTimeline(beatFrames);

    // Reset the playback state
    this.playing.set(false);
    this.songTime.set(0);
    this.songDuration.set(time);

    this.currentBeatIndex.set(0);
    this.repeatState.set({
      iteration: 0,
      exiting: false,
    });

    // TODO: Set playing and seek to the previous location
  }

  private reset(): void {
    this.song = undefined;
    this.beatFrames.clear();

    this.playing.set(false);
    this.songTime.set(0);
    this.songDuration.set(0);

    this.currentBeatIndex.set(0);
    this.repeatState.set({
      iteration: 0,
      exiting: false,
    });
  }

  load(song: Song): void {
    // Unload previous song
    if (this.isReady()) {
      this.unload();
    }

    try {
      this.song = song;

      this.generateBeatFrames();

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

  private update(delta: number): void {
    const time = this.songTime.get();
    const nextTime = time + delta;

    // TODO: Stop and skip update if there are no beats or we reached the end. Also implement segue later

    const beat = this.currentBeat.get();
    if (!beat) {
      throw new Error("No current beat.");
    }

    // Move on to the next beat if we surpassed the current one
    if (nextTime > beat.time + beat.duration) {
      let nextBeatIndex = this.currentBeatIndex.get() + 1;
      const nominalNextBeat = this.beatFrames.items()[nextBeatIndex];
      if (!nominalNextBeat) {
        throw new EngineStateError("Now next beat.");
      }

      // Reset the repeat state when we've entered a new repeat
      if (nominalNextBeat.repeat && nominalNextBeat.repeat.beatFrameIndex !== beat.repeat?.beatFrameIndex) {
        this.repeatState.set({
          iteration: 0,
          exiting: false,
        });
      }

      // Check if the next beat would be the end of a current repeat
      if (nominalNextBeat.cut) {
        nextBeatIndex += nominalNextBeat.cut.length;
      } else if (beat.repeat) {
        const repeatStart = this.beatFrames.items()[beat.repeat.beatFrameIndex];
        const measuresWithinRepeat = nextBeatIndex - repeatStart.measureIndex;
        const beatsWithinRepeat = nextBeatIndex - beat.repeat.beatFrameIndex;
        let exit = false;

        // Check if we should loop or exit
        if (measuresWithinRepeat >= beat.repeat.length) {
          const repeatState = this.repeatState.get();

          // On a counted repeat, check if we surpassed the fixed number of iterations. If not, count one more iteration
          if (beat.repeat.exit.type === "count") {
            if (repeatState.iteration > beat.repeat.exit.iterations) {
              // Exit counted repeat when the fixed number of iterations passed
              exit = true;
            } else {
              // Count iteration
              this.repeatState.set({
                ...repeatState,
                iteration: repeatState.iteration + 1,
              });
            }
          }
        }

        // If not exiting, jump back to the start of the repeat
        if (!exit) {
          nextBeatIndex = beat.repeat.beatFrameIndex;
        }
      }

      // Update the next beat
      this.currentBeatIndex.set(nextBeatIndex);
    }

    // Update the current time
    this.songTime.set(nextTime);
  }

  seek(time: number): void {

  }

  play(): void {

  }

  pause(): void {

  }
}
