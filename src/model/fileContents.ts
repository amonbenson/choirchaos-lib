import { type MidiData } from "midi-file";

import { type WarpPoint } from "@/utils/warpCurve";

export type MediaSyncInfo = {
  warpPoints: WarpPoint[];
};

export type ScoreSyncInfo = {
  _dummy?: undefined;
};

type FileContentsBase = {
  id: string;
  buffer: ArrayBuffer;
};

export type MP3FileContents = FileContentsBase & {
  type: "mp3";
  syncInfo: MediaSyncInfo;
};

export type WaveFileContents = FileContentsBase & {
  type: "wav";
  syncInfo: MediaSyncInfo;
};

export type MidiFileContents = FileContentsBase & {
  type: "mid";
  syncInfo: MediaSyncInfo;
  midiData: MidiData;
};

export type PdfFileContents = FileContentsBase & {
  type: "pdf";
  syncInfo: ScoreSyncInfo;
};

export type FileContents = MP3FileContents | WaveFileContents | MidiFileContents | PdfFileContents;
