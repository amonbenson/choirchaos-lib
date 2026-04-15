import { type Disposable } from "@/utils/events";

import type Transport from "../transport";
import Mixer from "./mixer";

export default class AudioEngine {
  listeners: {
    loadedChange: Disposable;
    playingChange: Disposable;
  };

  private audioContext = new AudioContext();
  private mixer: Mixer;

  constructor(private transport: Transport) {
    this.mixer = new Mixer(transport);

    // Register transport listeners
    this.listeners = {
      loadedChange: transport.onLoadedChange(this.handleLoadedChange),
      playingChange: transport.onPlayingChange(this.handlePlayingChange),
    };
  }

  private handleLoadedChange(loaded: boolean): void {
    // Update the mixer state
    if (loaded) {
      this.mixer.setup(this.audioContext);
    } else {
      this.mixer.dispose();
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
    this.mixer.dispose();
  }
}
