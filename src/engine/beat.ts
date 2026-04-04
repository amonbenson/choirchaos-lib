import { MeasureReference } from "@/model/measureReference";
import { Tempo } from "@/music";
import { BinarySortedList } from "@/utils/binarySearch";

export default class Beat {
  constructor(
    public time: number,
    public duration: number,
    public reference: MeasureReference,
    public tempo: Tempo,
  ) {}
}

export class BeatList extends BinarySortedList<Beat> {
  constructor(items?: Beat[]) {
    super(items, {
      comparator: (a, b) => a.time - b.time,
    });
  }
}
