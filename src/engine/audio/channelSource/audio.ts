import { type Frame } from "@/engine/compiler";

import ChannelSource from "./base";

export default class AudioChannelSource extends ChannelSource {
  getOutputNode(): AudioNode {
    throw new Error("Method not implemented.");
  }

  setup(_context: AudioContext): void {
  }

  dispose(): void {
    super.dispose();
  }

  protected handlePlayingChange(_playing: boolean): void {
  }

  protected handleCurrentTimeChange(_time: number): void {
  }

  protected handleFrameChange(_frame: Frame | undefined): void {
  }
};
