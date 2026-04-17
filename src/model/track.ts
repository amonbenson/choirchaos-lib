export type MidiMedia = {
  type: "midi";
  fileId: string;
  midiTrackNames: string[];
};

export type AudioMedia = {
  type: "audio";
  fileId: string;
};

export type TrackMedia = MidiMedia | AudioMedia;

export type Track = {
  group: "instrumental" | "vocal";
  name: string;

  media?: TrackMedia;
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
