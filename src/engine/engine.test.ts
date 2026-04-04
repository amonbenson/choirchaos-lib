import { describe, expect, it, vi } from "vitest";

import type { Song } from "@/model/song";
import type { SongId } from "@/model/song";
import { createSong } from "@/model/song";

import Engine from "./engine.js";

function makeSong(title = "Test Song"): Song {
  return createSong("song-1" as SongId, undefined, title);
}

describe("Engine", () => {
  describe("load", () => {
    it("becomes ready after loading a song", () => {
      const engine = new Engine();

      engine.load(makeSong());

      expect(engine.isReady()).toBe(true);
    });

    it("fires onReady when a song is loaded", () => {
      const engine = new Engine();
      const listener = vi.fn();

      engine.onReady(listener);
      engine.load(makeSong());

      expect(listener).toHaveBeenCalledOnce();
    });

    it("unloads the previous song before loading a new one", () => {
      const engine = new Engine();
      const onUnloaded = vi.fn();

      engine.onUnloaded(onUnloaded);
      engine.load(makeSong("First"));
      engine.load(makeSong("Second"));

      expect(onUnloaded).toHaveBeenCalledOnce();
    });

    it("fires onReady for each loaded song", () => {
      const engine = new Engine();
      const onReady = vi.fn();

      engine.onReady(onReady);
      engine.load(makeSong("First"));
      engine.load(makeSong("Second"));

      expect(onReady).toHaveBeenCalledTimes(2);
    });
  });

  describe("unload", () => {
    it("is no longer ready after unloading", () => {
      const engine = new Engine();

      engine.load(makeSong());
      engine.unload();

      expect(engine.isReady()).toBe(false);
    });

    it("fires onUnloaded when a song is unloaded", () => {
      const engine = new Engine();
      const listener = vi.fn();

      engine.onUnloaded(listener);
      engine.load(makeSong());
      engine.unload();

      expect(listener).toHaveBeenCalledOnce();
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
      engine.load(makeSong());
      engine.unload();
      engine.unload();

      expect(onUnloaded).toHaveBeenCalledOnce();
    });
  });
});
