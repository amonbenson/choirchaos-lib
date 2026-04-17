import { type Disposable } from "@/utils/events";

import type Transport from "../transport";
import Mixer from "./mixer";

export default class AudioEngine {
  listeners: {
    loadedChange: Disposable;
    playingChange: Disposable;
  };

  private audioContext = new AudioContext();
  private mixer?: Mixer;

  constructor(private transport: Transport) {
    // Register transport listeners
    this.listeners = {
      loadedChange: transport.onLoadedChange((value: boolean) => this.handleLoadedChange(value)),
      playingChange: transport.onPlayingChange((value: boolean) => this.handlePlayingChange(value)),
    };
  }

  private handleLoadedChange(loaded: boolean): void {
    // Update the mixer state
    if (loaded) {
      // Create a fresh mixer on song load
      this.mixer?.dispose();
      this.mixer = new Mixer(this.audioContext, this.transport);
    } else {
      // Remove the old mixer on unload
      this.mixer?.dispose();
    }
  }

  private handlePlayingChange(playing: boolean): void {
    if (playing) {
      // Resume audio context when we start playing
      this.resumeAudioContext();
    }
  }

  resumeAudioContext(): void {
    if (this.audioContext.state !== "running") {
      this.audioContext.resume().then(() => {});
    }
  }

  dispose(): void {
    // Dispose all listeners
    for (const listener of Object.values(this.listeners)) {
      listener.dispose();
    }

    // Destroy the audio mixer
    this.mixer?.dispose();
  }
}
