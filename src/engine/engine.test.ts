import { describe, expect, it, vi } from "vitest";

import { beat, beats, measure, song } from "@/test/utils.js";

import Engine from "./engine.js";

// A repeat (count-based) that extends past the end of a 1-measure song - useful as a generic invalid song
const invalidSong = song(
  measure([beat()], { type: "repeat", length: 3, exit: { type: "count", iterations: 2 }, safety: false }),
);

const simpleSong = song(
  measure(beats(4)),
  measure(beats(4)),
);

describe("Engine", () => {
  describe("load", () => {
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
});
