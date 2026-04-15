import { EngineAudioStateError } from "../errors";
import type Transport from "../transport";
import ChannelStrip from "./channelStrip";

export default class Mixer {
  private masterGain: GainNode | undefined;
  private channelStrips: ChannelStrip[];

  constructor(private transport: Transport) {
    this.channelStrips = [];
  }

  getOutputNode(): AudioNode {
    if (!this.masterGain) {
      throw new EngineAudioStateError("Cannot return output node: Mixer is not setup.");
    }

    return this.masterGain;
  }

  setup(context: AudioContext): void {
    if (this.channelStrips.length > 0) {
      throw new EngineAudioStateError("Cannot setup Mixer: Already contains channel strips. Run dispose() first.");
    }

    // Lookup the song from the transport object
    const song = this.transport.getSong();
    if (!song) {
      throw new EngineAudioStateError("Cannot setup Mixer: No song loaded.");
    }

    this.masterGain = new GainNode(context);

    // Create all channel strips and connect them to the master output gain
    for (let trackIndex = 0; trackIndex < song.tracks.length; trackIndex++) {
      const channelStrip = new ChannelStrip(this.transport, trackIndex);
      channelStrip.setup(context);
      channelStrip.getOutputNode().connect(this.masterGain);
      this.channelStrips.push(channelStrip);
    }
  }

  dispose(): void {
    // Disconnect and destroy each channel strip
    for (const channelStrip of this.channelStrips) {
      channelStrip.getOutputNode().disconnect();
      channelStrip.dispose();
    }

    // Reset the channel strips array
    this.channelStrips = [];
  }
}
