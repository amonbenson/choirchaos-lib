import { describe, expect, it, vi } from "vitest";

import { type CutDirection } from "@/model/direction";
import { beats, measure, song } from "@/test/utils";

import { compile } from "./compiler";
import Transport from "./transport";

const simpleSong = song(
  measure(beats(4)),
  measure(beats(4)),
);

const compiledSimpleSong = compile(simpleSong);

describe("Transport", () => {
  describe("load", () => {
    it("becomes loaded after loading a compiled song", () => {
      const transport = new Transport();

      transport.load(compiledSimpleSong);

      expect(transport.isLoaded()).toBe(true);
    });

    it("fires onLoadedChange(true) when a compiled song is loaded", () => {
      const transport = new Transport();
      const onLoaded = vi.fn();

      transport.onLoadedChange((isLoaded) => {
        if (isLoaded) {
          onLoaded();
        }
      });
      transport.load(compiledSimpleSong);

      expect(onLoaded).toHaveBeenCalledOnce();
    });
  });

  describe("unload", () => {
    it("is no longer loaded after unloading", () => {
      const transport = new Transport();

      transport.load(compiledSimpleSong);
      transport.unload();

      expect(transport.isLoaded()).toBe(false);
    });

    it("fires onLoadedChange(false) when a song is unloaded", () => {
      const transport = new Transport();
      const onUnloaded = vi.fn();

      transport.onLoadedChange((isLoaded) => {
        if (!isLoaded) {
          onUnloaded();
        }
      });
      transport.load(compiledSimpleSong);
      transport.unload();

      expect(onUnloaded).toHaveBeenCalledOnce();
    });

    it("does nothing when no song is loaded", () => {
      const transport = new Transport();
      const onUnloaded = vi.fn();

      transport.onLoadedChange((isLoaded) => {
        if (!isLoaded) {
          onUnloaded();
        }
      });
      transport.unload();

      expect(onUnloaded).not.toHaveBeenCalled();
    });

    it("is idempotent - unloading twice only fires onLoadedChange(false) once", () => {
      const transport = new Transport();
      const onUnloaded = vi.fn();

      transport.onLoadedChange((isLoaded) => {
        if (!isLoaded) {
          onUnloaded();
        }
      });
      transport.load(compiledSimpleSong);
      transport.unload();
      transport.unload();

      expect(onUnloaded).toHaveBeenCalledOnce();
    });
  });

  describe("seek", () => {
    it("sets the time correctly", () => {
      const transport = new Transport();
      transport.load(compiledSimpleSong);

      transport.seek(0.5);
      expect(transport.getSongTime()).toBeCloseTo(0.5);

      transport.seek(3.5);
      expect(transport.getSongTime()).toBeCloseTo(3.5);
    });

    it("clamps the time to the song length", () => {
      const transport = new Transport();
      transport.load(compiledSimpleSong);

      transport.seek(4.5);
      expect(transport.getSongTime()).toBeCloseTo(4.0);

      transport.seek(-0.5);
      expect(transport.getSongTime()).toBeCloseTo(0.0);
    });

    it("updates the current frame correctly", () => {
      const transport = new Transport();
      transport.load(compiledSimpleSong);

      // Check transition from beat 0 to beat 1
      transport.seek(0.4);
      expect(transport.getCurrentFrame()?.index).toBe(0);

      transport.seek(0.5);
      expect(transport.getCurrentFrame()?.index).toBe(1);

      transport.seek(0.6);
      expect(transport.getCurrentFrame()?.index).toBe(1);

      // Check end-of-song transition
      transport.seek(3.9);
      expect(transport.getCurrentFrame()?.index).toBe(7);

      transport.seek(4.0);
      expect(transport.getCurrentFrame()?.index).toBe(8);

      transport.seek(4.1);
      expect(transport.getCurrentFrame()?.index).toBe(8);

      transport.seek(10);
      expect(transport.getCurrentFrame()?.index).toBe(8);
    });

    it("restores the current playing value", () => {
      const transport = new Transport();

      const onPlayingChange = vi.fn();
      transport.onPlayingChange(onPlayingChange);

      transport.load(compiledSimpleSong);

      transport.play(); // First call
      transport.seek(2.0); // Second and third call
      expect(transport.isPlaying()).toBe(true);
      expect(onPlayingChange).toHaveBeenCalledTimes(3);
    });
  });

  describe("step", () => {
    it("updates the current time correctly", () => {
      const transport = new Transport();
      transport.load(compiledSimpleSong);
      transport.play();

      transport.step(0.1);

      expect(transport.getCurrentFrame()?.index).toBe(0);
      expect(transport.getSongTime()).toBeCloseTo(0.1);
    });

    it("updates the next frame correctly", () => {
      const transport = new Transport();
      transport.load(compiledSimpleSong);
      transport.play();

      transport.step(0.4);
      expect(transport.getCurrentFrame()?.index).toBe(0);

      transport.step(0.2);
      expect(transport.getCurrentFrame()?.index).toBe(1);
    });

    it("stops at the end of the song", () => {
      const transport = new Transport();
      transport.load(compiledSimpleSong);
      transport.play();

      // Step to the end of the last frame
      while (transport.getSongTime() < 3.85) {
        transport.step(0.1);
      }

      expect(transport.getCurrentFrame()?.index).toBe(7);
      expect(transport.getSongTime()).toBeCloseTo(3.9);

      // Step over the end of the song
      transport.step(0.2);

      expect(transport.getCurrentFrame()?.index).toBe(8);
      expect(transport.getSongTime()).toBeCloseTo(4.0);
      expect(transport.isPlaying()).toBe(false);
    });

    describe("applies cut jumps correctly", () => {
      const cut1: CutDirection = { type: "cut", length: 1 };

      it("jumps a single cut section in the middle of a song", () => {
        const transport = new Transport();
        transport.load(compile(song(
          measure(beats(4)),
          measure(beats(4), cut1),
          measure(beats(4)),
        )));
        transport.play();

        transport.step(0.1);
        transport.step(0.5);
        transport.step(0.5);
        transport.step(0.5);

        expect(transport.getCurrentFrame()?.index).toBe(3);
        expect(transport.getSongTime()).toBeCloseTo(1.6);

        // Stepping one more beat should move is right into frame no. 8
        transport.step(0.5);

        expect(transport.getCurrentFrame()?.index).toBe(8);
        expect(transport.getSongTime()).toBeCloseTo(4.1);

        transport.step(0.1);
        expect(transport.getCurrentFrame()?.index).toBe(8);
        expect(transport.getSongTime()).toBeCloseTo(4.2);
      });

      it("jumps a single cut section at the end of a song", () => {
        const transport = new Transport();
        transport.load(compile(song(
          measure(beats(4)),
          measure(beats(4)),
          measure(beats(4), cut1),
        )));
        transport.play();

        while (transport.getSongTime() < 3.85) {
          transport.step(0.1);
        }

        expect(transport.getCurrentFrame()?.index).toBe(7);
        expect(transport.getSongTime()).toBeCloseTo(3.9);

        transport.step(0.2);

        expect(transport.getCurrentFrame()?.index).toBe(12);
        expect(transport.getSongTime()).toBeCloseTo(6.0);
      });

      it("jumps a single cut section at the start of a song", () => {
        const transport = new Transport();
        transport.load(compile(song(
          measure(beats(4), cut1),
          measure(beats(4)),
          measure(beats(4)),
        )));
        transport.play();

        transport.step(0.1);

        expect(transport.getCurrentFrame()?.index).toBe(4);
        expect(transport.getSongTime()).toBeCloseTo(2.1);
      });
    });
  });
});
