import { type Frame } from "@/engine/compiler";

import ChannelSource from "./base";

export default class MidiChannelSource extends ChannelSource {
  getOutputNode(): AudioNode {
    throw new Error("Method not implemented.");
  }

  setup(_context: AudioContext): void {
  }

  destroy(): void {
    super.destroy();
  }

  protected handlePlayingChange(_playing: boolean): void {
  }

  protected handleSongTimeChange(_time: number): void {
  }

  protected handleFrameChange(_frame: Frame | undefined): void {
  }
};
