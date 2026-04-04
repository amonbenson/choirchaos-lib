import { describe, expect, it, vi } from "vitest";

import { type Beat } from "@/model/beat";
import { type BeatDirection, type MeasureDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { createSong, type Song } from "@/model/song";
import { type SongId } from "@/model/song";
import { QuarterNote } from "@/music";

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
