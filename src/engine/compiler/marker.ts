import { type MarkerDirection } from "@/model/direction";

export default class Marker {
  constructor(
    public readonly frameIndex: number,
    public readonly sourceDirection: MarkerDirection,
  ) {}
};
