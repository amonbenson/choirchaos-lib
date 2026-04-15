import { type CompiledSong } from "@/engine/compiler";
import type Frame from "@/engine/compiler/frame";
import { EngineAudioStateError } from "@/engine/errors";
import type Transport from "@/engine/transport";
import { type Song } from "@/model/song";
import { type Disposable } from "@/utils/events";

export default abstract class ChannelSource {
  listeners: {
    playingChange: Disposable;
    songTimeChange: Disposable;
    frameChange: Disposable;
  };

  protected song: Song;
  protected compiledSong: CompiledSong;

  constructor(
    protected transport: Transport,
    protected trackIndex: number,
  ) {
    const compiledSong = transport.getCompiledSong();
    if (!compiledSong) {
      throw new EngineAudioStateError("ChannelSource cannot be constructed when no song is loaded.");
    }

    this.compiledSong = compiledSong;
    this.song = compiledSong.source;

    this.listeners = {
      playingChange: transport.onPlayingChange(this.handlePlayingChange),
      songTimeChange: transport.onSongTimeChange(this.handleSongTimeChange),
      frameChange: transport.onFrameChange(this.handleFrameChange),
    };
  }

  abstract getOutputNode(): AudioNode;

  abstract setup(context: AudioContext): void;
  destroy(): void {
    // Dispose all listeners
    for (const listener of Object.values(this.listeners)) {
      listener.dispose();
    }
  }

  protected abstract handlePlayingChange(playing: boolean): void;
  protected abstract handleSongTimeChange(time: number): void;
  protected abstract handleFrameChange(frame: Frame | undefined): void;
};
