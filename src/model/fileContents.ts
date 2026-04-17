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

export type MediaFileContents = FileContentsBase & {
  type: "audio" | "midi";
  syncInfo: MediaSyncInfo;
};

export type ScoreFileContents = FileContentsBase & {
  type: "pdf";
  syncInfo: ScoreSyncInfo;
};

export type FileContents = MediaFileContents | ScoreFileContents;
