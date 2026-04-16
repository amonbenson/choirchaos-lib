import { type Location, type Region } from "@/engine/transport";
import { type AudioData } from "@/model/track";

import ChannelSource from "./base";

export default class AudioChannelSource extends ChannelSource<AudioData> {
  getOutputNode(): AudioNode {
    throw new Error("Method not implemented.");
  }

  setup(_context: AudioContext): void {
  }

  dispose(): void {
    super.dispose();
  }

  protected handlePlay(): void {
  }

  protected handlePause(): void {
  }

  protected handleSeek(_location: Location): void {
  }

  protected handleRender(_region: Region): void {
  }
};
