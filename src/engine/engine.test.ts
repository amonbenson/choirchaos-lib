import { describe, expect, it, vi } from "vitest";

import { type Beat } from "@/model/beat";
import { type BeatDirection, type MeasureDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { createSong, type Song } from "@/model/song";
import { type SongId } from "@/model/song";
import { QuarterNote } from "@/music";

import { type BeatFrame } from "./beatFrame.js";
import Engine from "./engine.js";
import { SongStructureError } from "./errors.js";

// --- Fixtures ---

function beat(...directions: BeatDirection[]): Beat {
  return { directions };
}

function measure(beats: Beat[], ...directions: MeasureDirection[]): Measure {
  return { beats, directions };
}

function song(...measures: Measure[]): Song {
  return { ...createSong("test" as SongId), measures };
}

const simpleSong = song(
  measure([beat(), beat(), beat(), beat()]),
  measure([beat(), beat(), beat(), beat()]),
);

// --- Tests ---

describe("Engine", () => {
  describe("load", () => {
    it("becomes ready after loading a song", () => {
      const engine = new Engine();

      engine.load(simpleSong);

      expect(engine.isReady()).toBe(true);
    });

    it("fires onReady when a song is loaded", () => {
      const engine = new Engine();
      const onReady = vi.fn();

      engine.onReady(onReady);
      engine.load(simpleSong);

      expect(onReady).toHaveBeenCalledOnce();
    });

    it("unloads the previous song before loading a new one", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onUnloaded(onUnloaded);
      engine.load(song(measure([beat()])));
      engine.load(song(measure([beat()])));

      expect(onUnloaded).toHaveBeenCalledOnce();
    });

    it("fires onReady for each loaded song", () => {
      const engine = new Engine();
      const onReady = vi.fn();

      engine.onReady(onReady);
      engine.load(song(measure([beat()])));
      engine.load(song(measure([beat()])));

      expect(onReady).toHaveBeenCalledTimes(2);
    });

    it("fires onError and not onUnloaded when the song is invalid", () => {
      const engine = new Engine();
      const onError = vi.fn();
      const onUnloaded = vi.fn();

      engine.onError(onError);
      engine.onUnloaded(onUnloaded);

      const invalidSong = song(
        measure([beat()], { type: "repeat", length: 3, iterations: 2 }),
      );

      engine.load(invalidSong);

      expect(onError).toHaveBeenCalledOnce();
      expect(onUnloaded).not.toHaveBeenCalled();
    });

    it("is not ready after a failed load", () => {
      const engine = new Engine();

      const invalidSong = song(
        measure([beat()], { type: "repeat", length: 3, iterations: 2 }),
      );

      engine.load(invalidSong);

      expect(engine.isReady()).toBe(false);
    });

    it("can recover by loading a valid song after a failed load", () => {
      const engine = new Engine();
      const onReady = vi.fn();

      engine.onReady(onReady);

      const invalidSong = song(
        measure([beat()], { type: "repeat", length: 3, iterations: 2 }),
      );

      engine.load(invalidSong);
      engine.load(simpleSong);

      expect(onReady).toHaveBeenCalledOnce();
      expect(engine.isReady()).toBe(true);
    });
  });

  describe("unload", () => {
    it("is no longer ready after unloading", () => {
      const engine = new Engine();

      engine.load(simpleSong);
      engine.unload();

      expect(engine.isReady()).toBe(false);
    });

    it("fires onUnloaded when a song is unloaded", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onUnloaded(onUnloaded);
      engine.load(simpleSong);
      engine.unload();

      expect(onUnloaded).toHaveBeenCalledOnce();
    });

    it("does nothing when no song is loaded", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onUnloaded(onUnloaded);
      engine.unload();

      expect(onUnloaded).not.toHaveBeenCalled();
    });

    it("is idempotent - unloading twice only fires onUnloaded once", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onUnloaded(onUnloaded);
      engine.load(simpleSong);
      engine.unload();
      engine.unload();

      expect(onUnloaded).toHaveBeenCalledOnce();
    });
  });

  describe("generateBeatFrames", () => {
    describe("valid songs", () => {
      it("loads an empty song with no measures", () => {
        const engine = new Engine();
        const onReady = vi.fn();

        engine.onReady(onReady);
        engine.load(song());

        expect(onReady).toHaveBeenCalledOnce();
      });

      it("loads a song with beat and measure directions", () => {
        const engine = new Engine();
        const onReady = vi.fn();

        engine.onReady(onReady);
        engine.load(song(
          measure(
            [beat({ type: "tempoChange", value: { bpm: 100, pulse: QuarterNote } })],
            { type: "measureNumberChange", value: "5" as any },
            { type: "marker", value: "Verse" },
          ),
          measure(
            [beat({ type: "timeSignatureChange", value: { beats: 3, denominator: 4 } })],
          ),
        ));

        expect(onReady).toHaveBeenCalledOnce();
      });

      it("loads a song with a repeat that ends exactly within the song", () => {
        const engine = new Engine();
        const onReady = vi.fn();

        engine.onReady(onReady);
        engine.load(song(
          measure([beat()], { type: "repeat", length: 1, iterations: 2 }),
          measure([beat()]),
        ));

        expect(onReady).toHaveBeenCalledOnce();
      });

      it("loads a song with a vamp that ends exactly within the song", () => {
        const engine = new Engine();
        const onReady = vi.fn();

        engine.onReady(onReady);
        engine.load(song(
          measure([beat()], { type: "vamp", length: 1, exit: { type: "end" }, safety: false }),
          measure([beat()]),
        ));

        expect(onReady).toHaveBeenCalledOnce();
      });

      it("loads a song with a cut that ends exactly within the song", () => {
        const engine = new Engine();
        const onReady = vi.fn();

        engine.onReady(onReady);
        engine.load(song(
          measure([beat()], { type: "cut", length: 1 }),
          measure([beat()]),
        ));

        expect(onReady).toHaveBeenCalledOnce();
      });
    });

    describe("overlapping directions", () => {
      it("fires onError with SongStructureError when a repeat overlaps another repeat", () => {
        const engine = new Engine();
        let error: Error | undefined;

        engine.onError((err) => {
          error = err;
        });
        engine.load(song(
          measure([beat()], { type: "repeat", length: 3, iterations: 2 }),
          measure([beat()], { type: "repeat", length: 2, iterations: 2 }),
        ));

        expect(error).toBeInstanceOf(SongStructureError);
        expect((error as SongStructureError).measureIndex).toBe(1);
      });

      it("fires onError with SongStructureError when a vamp overlaps another vamp", () => {
        const engine = new Engine();
        let error: Error | undefined;

        engine.onError((err) => {
          error = err;
        });
        engine.load(song(
          measure([beat()], { type: "vamp", length: 3, exit: { type: "end" }, safety: false }),
          measure([beat()], { type: "vamp", length: 2, exit: { type: "end" }, safety: false }),
        ));

        expect(error).toBeInstanceOf(SongStructureError);
        expect((error as SongStructureError).measureIndex).toBe(1);
      });

      it("fires onError with SongStructureError when a vamp overlaps a repeat", () => {
        const engine = new Engine();
        let error: Error | undefined;

        engine.onError((err) => {
          error = err;
        });
        engine.load(song(
          measure([beat()], { type: "repeat", length: 3, iterations: 2 }),
          measure([beat()], { type: "vamp", length: 2, exit: { type: "end" }, safety: false }),
        ));

        expect(error).toBeInstanceOf(SongStructureError);
        expect((error as SongStructureError).measureIndex).toBe(1);
      });
    });

    describe("beat timing", () => {
      function loadAndGetFrames(...measures: Measure[]): BeatFrame[] {
        const engine = new Engine();
        engine.load(song(...measures));
        return engine.getBeatFrames();
      }

      it("assigns correct time and duration at the default tempo (120 BPM)", () => {
        // At 120 BPM: duration = 60/120 = 0.5s per beat
        const frames = loadAndGetFrames(measure([beat(), beat(), beat()]));

        expect(frames).toHaveLength(3);
        expect(frames[0]).toMatchObject({ time: 0, duration: 0.5 });
        expect(frames[1]).toMatchObject({ time: 0.5, duration: 0.5 });
        expect(frames[2]).toMatchObject({ time: 1.0, duration: 0.5 });
      });

      it("applies a tempo change immediately on the beat it appears", () => {
        // Beat 0: 120 BPM → 0.5s, beat 1: 60 BPM → 1.0s, beat 2: 60 BPM → 1.0s
        const frames = loadAndGetFrames(measure([
          beat(),
          beat({ type: "tempoChange", value: { bpm: 60, pulse: QuarterNote } }),
          beat(),
        ]));

        expect(frames[0]).toMatchObject({ time: 0, duration: 0.5 });
        expect(frames[1]).toMatchObject({ time: 0.5, duration: 1.0 });
        expect(frames[2]).toMatchObject({ time: 1.5, duration: 1.0 });
      });

      it("carries tempo across measure boundaries", () => {
        // Measure 0 at 60 BPM (1.0s/beat), measure 1 inherits that tempo
        const frames = loadAndGetFrames(
          measure([beat({ type: "tempoChange", value: { bpm: 60, pulse: QuarterNote } }), beat()]),
          measure([beat(), beat()]),
        );

        expect(frames).toHaveLength(4);
        expect(frames[0]).toMatchObject({ time: 0, duration: 1.0 });
        expect(frames[1]).toMatchObject({ time: 1.0, duration: 1.0 });
        expect(frames[2]).toMatchObject({ time: 2.0, duration: 1.0 });
        expect(frames[3]).toMatchObject({ time: 3.0, duration: 1.0 });
      });

      it("handles multiple tempo changes within a single measure", () => {
        // Beat 0: 120 BPM → 0.5s, beat 1: 60 BPM → 1.0s, beat 2: 30 BPM → 2.0s
        const frames = loadAndGetFrames(measure([
          beat(),
          beat({ type: "tempoChange", value: { bpm: 60, pulse: QuarterNote } }),
          beat({ type: "tempoChange", value: { bpm: 30, pulse: QuarterNote } }),
        ]));

        expect(frames[0]).toMatchObject({ time: 0, duration: 0.5 });
        expect(frames[1]).toMatchObject({ time: 0.5, duration: 1.0 });
        expect(frames[2]).toMatchObject({ time: 1.5, duration: 2.0 });
      });

      it("produces no beat frames for a song with no measures", () => {
        const frames = loadAndGetFrames();
        expect(frames).toHaveLength(0);
      });

      it("produces no beat frames for measures with no beats", () => {
        const frames = loadAndGetFrames(measure([]), measure([]));
        expect(frames).toHaveLength(0);
      });
    });

    describe("direction validation", () => {
      function expectStructureError(s: ReturnType<typeof song>): void {
        const engine = new Engine();
        let error: Error | undefined;

        engine.onError((err) => {
          error = err;
        });
        engine.load(s);

        expect(error).toBeInstanceOf(SongStructureError);
      }

      it("rejects a repeat with length < 1", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat()], { type: "repeat", length: 0, iterations: 2 })));
      });

      it("rejects a repeat with fewer than 2 iterations", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat()], { type: "repeat", length: 1, iterations: 1 })));
      });

      it("rejects a vamp with length < 1", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat()], { type: "vamp", length: 0, exit: { type: "end" }, safety: false })));
      });

      it("rejects a vamp with a bar exit interval < 1", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat()], { type: "vamp", length: 1, exit: { type: "bar", every: 0 }, safety: false })));
      });

      it("rejects a vamp with a beat exit interval < 1", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat()], { type: "vamp", length: 1, exit: { type: "beat", every: 0 }, safety: false })));
      });

      it("rejects a cut with length < 1", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat()], { type: "cut", length: 0 })));
      });

      it("rejects a tempo of 0 BPM", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat({ type: "tempoChange", value: { bpm: 0, pulse: QuarterNote } })])));
      });

      it("rejects a negative tempo", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat({ type: "tempoChange", value: { bpm: -120, pulse: QuarterNote } })])));
      });

      it("rejects a non-finite tempo", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat({ type: "tempoChange", value: { bpm: Infinity, pulse: QuarterNote } })])));
      });

      it("rejects a time signature with 0 beats", () => {
        expect.assertions(1);
        expectStructureError(song(measure([beat({ type: "timeSignatureChange", value: { beats: 0, denominator: 4 } })])));
      });
    });

    describe("directions extending past the end of the song", () => {
      it("fires onError for a repeat that exceeds the song length", () => {
        const engine = new Engine();
        let error: Error | undefined;

        engine.onError((err) => {
          error = err;
        });
        engine.load(song(
          measure([beat()], { type: "repeat", length: 3, iterations: 2 }),
          measure([beat()]),
        ));

        expect(error).toBeInstanceOf(SongStructureError);
        expect((error as SongStructureError).measureIndex).toBe(0);
      });

      it("fires onError for a vamp that exceeds the song length", () => {
        const engine = new Engine();
        let error: Error | undefined;

        engine.onError((err) => {
          error = err;
        });
        engine.load(song(
          measure([beat()], { type: "vamp", length: 3, exit: { type: "end" }, safety: false }),
          measure([beat()]),
        ));

        expect(error).toBeInstanceOf(SongStructureError);
        expect((error as SongStructureError).measureIndex).toBe(0);
      });

      it("fires onError for a cut that exceeds the song length", () => {
        const engine = new Engine();
        let error: Error | undefined;

        engine.onError((err) => {
          error = err;
        });
        engine.load(song(
          measure([beat()], { type: "cut", length: 3 }),
          measure([beat()]),
        ));

        expect(error).toBeInstanceOf(SongStructureError);
        expect((error as SongStructureError).measureIndex).toBe(0);
      });
    });
  });
});
