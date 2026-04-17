import { EngineAudioStateError } from "../errors";
import type Transport from "../transport";
import { AudioChannelSource, MidiChannelSource } from "./channelSource";
import type ChannelSource from "./channelSource/base";

export default class ChannelStrip {
  private channelSource?: ChannelSource;
  private channelGain: GainNode;

  constructor(
    private audioContext: AudioContext,
    private transport: Transport,
    private trackIndex: number,
  ) {
    // Lookup the track from the transport object
    const song = transport.getSong();
    if (!song) {
      throw new EngineAudioStateError("ChannelStrip cannot be constructed when no song is loaded.");
    }

    const track = song.tracks[trackIndex];

    // Create channel audio sources if data is available
    if (track.data.audio) {
      this.channelSource = new AudioChannelSource(this.audioContext, transport, trackIndex, track.data.audio);
    } else if (track.data.midi) {
      this.channelSource = new MidiChannelSource(this.audioContext, transport, trackIndex, track.data.midi);
    } else {
      this.channelSource = undefined;
    }

    // Create channel gain and connect the source node
    this.channelGain = new GainNode(this.audioContext);
    this.channelSource?.getOutputNode().connect(this.channelGain);
  }

  getOutputNode(): AudioNode {
    return this.channelGain;
  }

  dispose(): void {
    // Disconnect and destroy the channel source
    if (this.channelSource) {
      this.channelSource.getOutputNode().disconnect();
      this.channelSource.dispose();
    }
  }
};
