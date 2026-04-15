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

  describe("seek", () => {
    it("sets the time correctly", () => {
      const engine = new Engine();
      engine.load(simpleSong);

      engine.seek(0.5);
      expect(engine.getSongTime()).toBeCloseTo(0.5);

      engine.seek(3.5);
      expect(engine.getSongTime()).toBeCloseTo(3.5);
    });

    it("clamps the time to the song length", () => {
      const engine = new Engine();
      engine.load(simpleSong);

      engine.seek(4.5);
      expect(engine.getSongTime()).toBeCloseTo(4.0);

      engine.seek(-0.5);
      expect(engine.getSongTime()).toBeCloseTo(0.0);
    });

    it("updates the current frame correctly", () => {
      const engine = new Engine();
      engine.load(simpleSong);

      // Check transition from beat 0 to beat 1
      engine.seek(0.4);
      expect(engine.getCurrentFrame()?.index).toBe(0);

      engine.seek(0.5);
      expect(engine.getCurrentFrame()?.index).toBe(1);

      engine.seek(0.6);
      expect(engine.getCurrentFrame()?.index).toBe(1);

      // Check end-of-song transition
      engine.seek(3.9);
      expect(engine.getCurrentFrame()?.index).toBe(7);

      engine.seek(4.0);
      expect(engine.getCurrentFrame()?.index).toBe(8);

      engine.seek(4.1);
      expect(engine.getCurrentFrame()?.index).toBe(8);

      engine.seek(10);
      expect(engine.getCurrentFrame()?.index).toBe(8);
    });

    it("restores the current playing value", () => {
      const engine = new Engine();

      const onPlayingChange = vi.fn();
      engine.onPlayingChange(onPlayingChange);

      engine.load(simpleSong);

      engine.seek(1.0);
      expect(engine.isPlaying()).toBe(false);
      expect(onPlayingChange).not.toHaveBeenCalled();

      engine.play(); // First call
      engine.seek(2.0); // Second and third call
      expect(engine.isPlaying()).toBe(true);
      expect(onPlayingChange).toHaveBeenCalledTimes(3);
    });
  });
});
