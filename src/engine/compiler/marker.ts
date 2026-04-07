import { type MarkerDirection } from "@/model/direction";

export default class Marker {
  constructor(
    public readonly measureIndex: number,
    public readonly sourceDirection: MarkerDirection,
  ) {}
};
