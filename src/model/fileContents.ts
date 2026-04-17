export type FileContents = {
  id: string;
  type: "audio" | "midi" | "pdf";
  buffer: ArrayBuffer;
};
