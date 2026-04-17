export type MidiData = {
  fileId: string;
  channels: number[];
};

export type AudioData = {
  fileId: string;
};

export type Track = {
  group: "instrumental" | "vocal";
  name: string;

  data: {
    midi?: MidiData;
    audio?: AudioData;
  };
};

export function createTrack(group: "instrumental" | "vocal", name: string = ""): Track {
  return {
    group,
    name,

    data: {
      midi: undefined,
      audio: undefined,
    },
  };
}
