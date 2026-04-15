export type Track = {
  group: "instrumental" | "vocal";
  name: string;

  data: {
    midi?: never;
    audio?: never;
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
