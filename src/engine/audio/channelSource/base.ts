import { type CompiledSong } from "@/engine/compiler";
import { EngineAudioStateError } from "@/engine/errors";
import type Transport from "@/engine/transport";
import { type Location, type Region } from "@/engine/transport";
import { type Song } from "@/model/song";
import { type Disposable } from "@/utils/events";

export default abstract class ChannelSource<D = unknown> {
  listeners: {
    playingChange: Disposable;
    seek: Disposable;
    render: Disposable;
  };

  protected song: Song;
  protected compiledSong: CompiledSong;

  constructor(
    protected transport: Transport,
    protected trackIndex: number,
    protected data: D,
  ) {
    const compiledSong = transport.getCompiledSong();
    if (!compiledSong) {
      throw new EngineAudioStateError("ChannelSource cannot be constructed when no song is loaded.");
    }

    this.compiledSong = compiledSong;
    this.song = compiledSong.source;

    this.listeners = {
      playingChange: transport.onPlayingChange((playing: boolean) => playing ? this.handlePlay() : this.handlePause()),
      seek: transport.onSeek((value: Location) => this.handleSeek(value)),
      render: transport.onRender((value: Region) => this.handleRender(value)),
    };
  }

  abstract getOutputNode(): AudioNode;

  abstract setup(context: AudioContext): void;
  dispose(): void {
    // Dispose all listeners
    for (const listener of Object.values(this.listeners)) {
      listener.dispose();
    }
  }

  protected abstract handlePlay(): void;
  protected abstract handlePause(): void;
  protected abstract handleSeek(location: Location): void;
  protected abstract handleRender(region: Region): void;
};
