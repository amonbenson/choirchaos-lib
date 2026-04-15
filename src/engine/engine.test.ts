import { describe, expect, it, vi } from "vitest";

import { type Beat } from "@/model/beat";
import { type BeatDirection, type MeasureDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { createSong, type Song } from "@/model/song";
import { type SongId } from "@/model/song";

import Engine from "./engine.js";

function beat(...directions: BeatDirection[]): Beat {
  return { directions };
}

function measure(beats: Beat[], ...directions: MeasureDirection[]): Measure {
  return { beats, directions };
}

function song(...measures: Measure[]): Song {
  return { ...createSong("test" as SongId), measures };
}

// A repeat (count-based) that extends past the end of a 1-measure song - useful as a generic invalid song
const invalidSong = song(
  measure([beat()], { type: "repeat", length: 3, exit: { type: "count", iterations: 2 }, safety: false }),
);

const simpleSong = song(
  measure([beat(), beat(), beat(), beat()]),
  measure([beat(), beat(), beat(), beat()]),
);

describe("Engine", () => {
  describe("load", () => {
    it("becomes ready after loading a song", () => {
      const engine = new Engine();

      engine.load(simpleSong);

      expect(engine.isReady()).toBe(true);
    });

    it("fires onReadyChange(true) when a song is loaded", () => {
      const engine = new Engine();
      const onReady = vi.fn();

      engine.onReadyChange((isReady) => {
        if (isReady) {
          onReady();
        }
      });
      engine.load(simpleSong);

      expect(onReady).toHaveBeenCalledOnce();
    });

    it("unloads the previous song before loading a new one", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onReadyChange((isReady) => {
        if (!isReady) {
          onUnloaded();
        }
      });
      engine.load(song(measure([beat()])));
      engine.load(song(measure([beat()])));

      expect(onUnloaded).toHaveBeenCalledOnce();
    });

    it("fires onReadyChange(true) for each loaded song", () => {
      const engine = new Engine();
      const onReady = vi.fn();

      engine.onReadyChange((isReady) => {
        if (isReady) {
          onReady();
        }
      });
      engine.load(song(measure([beat()])));
      engine.load(song(measure([beat()])));

      expect(onReady).toHaveBeenCalledTimes(2);
    });

    it("throws and does not fire onReadyChange when the song is invalid", () => {
      const engine = new Engine();
      const onChange = vi.fn();

      engine.onReadyChange(onChange);

      expect(() => engine.load(invalidSong)).toThrow();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("is not ready after a failed load", () => {
      const engine = new Engine();

      expect(() => engine.load(invalidSong)).toThrow();

      expect(engine.isReady()).toBe(false);
    });

    it("can recover by loading a valid song after a failed load", () => {
      const engine = new Engine();
      const onReady = vi.fn();

      engine.onReadyChange((isReady) => {
        if (isReady) {
          onReady();
        }
      });
      expect(() => engine.load(invalidSong)).toThrow();
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

    it("fires onReadyChange(false) when a song is unloaded", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onReadyChange((isReady) => {
        if (!isReady) {
          onUnloaded();
        }
      });
      engine.load(simpleSong);
      engine.unload();

      expect(onUnloaded).toHaveBeenCalledOnce();
    });

    it("does nothing when no song is loaded", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onReadyChange((isReady) => {
        if (!isReady) {
          onUnloaded();
        }
      });
      engine.unload();

      expect(onUnloaded).not.toHaveBeenCalled();
    });

    it("is idempotent - unloading twice only fires onReadyChange(false) once", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onReadyChange((isReady) => {
        if (!isReady) {
          onUnloaded();
        }
      });
      engine.load(simpleSong);
      engine.unload();
      engine.unload();

      expect(onUnloaded).toHaveBeenCalledOnce();
    });
  });
});
