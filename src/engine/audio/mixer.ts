import { EngineAudioStateError } from "../errors";
import type Transport from "../transport";
import ChannelStrip from "./channelStrip";

export default class Mixer {
  private masterGain: GainNode;
  private channelStrips: ChannelStrip[];

  constructor(private audioContext: AudioContext, private transport: Transport) {
    // Lookup the song from the transport object
    const song = transport.getSong();
    if (!song) {
      throw new EngineAudioStateError("Cannot setup Mixer: No song loaded.");
    }

    // Master output gain
    this.masterGain = new GainNode(audioContext);

    // Create all channel strips and connect them to the master output gain
    this.channelStrips = song.tracks.map((_, trackIndex) => {
      const channelStrip = new ChannelStrip(audioContext, this.transport, trackIndex);
      channelStrip.getOutputNode().connect(this.masterGain);
      return channelStrip;
    });
  }

  getOutputNode(): AudioNode {
    return this.masterGain;
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
