import { describe, expect, it } from "vitest";

import { type Beat } from "@/model/beat";
import { type BeatDirection, type CutDirection, type MarkerDirection, type MeasureDirection, type RepeatDirection, type TempoChangeDirection, type TimeSignatureChangeDirection } from "@/model/direction";
import { type Measure } from "@/model/measure";
import { createSong, type Song } from "@/model/song";
import { type SongId } from "@/model/song";
import { asNumbering, DefaultTempo, DefaultTimeSignature, QuarterNote } from "@/music";

import { compile } from "./compiler";
import { SongStructureError } from "./errors";

function beat(...directions: BeatDirection[]): Beat {
  return { directions };
}

function measure(beats: Beat[], ...directions: MeasureDirection[]): Measure {
  return { beats, directions };
}

function song(...measures: Measure[]): Song {
  return { ...createSong("test" as SongId), measures };
}

function beats(n: number): Beat[] {
  return Array.from({ length: n }, () => beat());
}

describe("compile", () => {
  it("compiles an empty song into a single final measure with one beat and default settings", () => {
    const emptySong = song();
    const result = compile(emptySong);

    // Exactly one measure - the synthetic final measure
    expect(result.measures).toHaveLength(1);

    const measure = result.measures[0];

    expect(measure.index).toBe(0);
    expect(measure.number).toBe(asNumbering("1"));
    expect(measure.time).toBe(0);
    // Default tempo: 120 BPM -> 60/120 = 0.5s per beat
    expect(measure.duration).toBeCloseTo(0.5);
    expect(measure.marker).toBeUndefined();
    expect(measure.repeat).toBeUndefined();
    expect(measure.cut).toBeUndefined();

    // Exactly one beat
    expect(measure.beats).toHaveLength(1);

    const beat = measure.beats[0];

    expect(beat.index).toEqual({ measure: 0, beat: 0 });
    expect(beat.time).toBe(0);
    expect(beat.duration).toBeCloseTo(0.5);
    expect(beat.tempo).toEqual(DefaultTempo);
    expect(beat.timeSignature).toEqual(DefaultTimeSignature);
    expect(beat.jumps).toHaveLength(0);
    expect(result.duration).toBeCloseTo(0);
  });

  it("compiles a 3-measure song with 4 beats each into 3 real measures plus a final measure", () => {
    const result = compile(song(
      measure(beats(4)),
      measure(beats(4)),
      measure(beats(4)),
    ));

    // 3 real measures + 1 synthetic final measure
    expect(result.measures).toHaveLength(4);

    // Default tempo: 120 BPM -> 0.5s per beat, 2.0s per measure
    const m0 = result.measures[0];
    const m1 = result.measures[1];
    const m2 = result.measures[2];

    // Measure indices and numbering
    expect(m0.index).toBe(0);
    expect(m1.index).toBe(1);
    expect(m2.index).toBe(2);
    expect(m0.number).toBe(asNumbering("1"));
    expect(m1.number).toBe(asNumbering("2"));
    expect(m2.number).toBe(asNumbering("3"));

    // Measure beat counts
    expect(m0.beats).toHaveLength(4);
    expect(m1.beats).toHaveLength(4);
    expect(m2.beats).toHaveLength(4);

    // Measure times and durations
    expect(m0.time).toBeCloseTo(0);
    expect(m1.time).toBeCloseTo(2.0);
    expect(m2.time).toBeCloseTo(4.0);
    expect(m0.duration).toBeCloseTo(2.0);
    expect(m1.duration).toBeCloseTo(2.0);
    expect(m2.duration).toBeCloseTo(2.0);

    // Spot-check beat timing across measure boundaries: last beat of m1 and first beat of m2
    const m1LastBeat = m1.beats[3];
    const m2FirstBeat = m2.beats[0];

    expect(m1LastBeat.index).toEqual({ measure: 1, beat: 3 });
    expect(m1LastBeat.time).toBeCloseTo(3.5);
    expect(m1LastBeat.duration).toBeCloseTo(0.5);
    expect(m1LastBeat.tempo).toEqual(DefaultTempo);
    expect(m1LastBeat.timeSignature).toEqual(DefaultTimeSignature);

    expect(m2FirstBeat.index).toEqual({ measure: 2, beat: 0 });
    expect(m2FirstBeat.time).toBeCloseTo(4.0);
    expect(m2FirstBeat.duration).toBeCloseTo(0.5);

    // Final synthetic measure starts right after the last real measure
    const finalMeasure = result.measures[3];

    expect(finalMeasure.index).toBe(3);
    expect(finalMeasure.number).toBe(asNumbering("4"));
    expect(finalMeasure.time).toBeCloseTo(6.0);
    expect(finalMeasure.duration).toBeCloseTo(0.5);
    expect(finalMeasure.beats).toHaveLength(1);
    expect(result.duration).toBeCloseTo(6.0);
  });

  describe("tempo changes", () => {
    const tempo60: TempoChangeDirection = {
      type: "tempoChange",
      value: { bpm: 60, pulse: QuarterNote },
    };

    it("applies a tempo change on beat 0 of the first measure to the entire song", () => {
      // 60 BPM -> 1.0s per beat; both measures must reflect this: 4 beats × 1.0s = 4.0s each
      const result = compile(song(
        measure([beat(tempo60), ...beats(3)]),
        measure(beats(4)),
      ));

      expect(result.measures[0].duration).toBeCloseTo(4.0);
      expect(result.measures[1].time).toBeCloseTo(4.0);
      expect(result.measures[1].duration).toBeCloseTo(4.0);
      expect(result.measures[0].beats[0].duration).toBeCloseTo(1.0);
      expect(result.duration).toBeCloseTo(8.0);
    });

    it("applies a tempo change on beat 0 of a later measure from that measure onwards", () => {
      // M0: 120 BPM -> 4 × 0.5s = 2.0s; m1: 60 BPM -> 4 × 1.0s = 4.0s
      const result = compile(song(
        measure(beats(4)),
        measure([beat(tempo60), ...beats(3)]),
      ));

      expect(result.measures[0].duration).toBeCloseTo(2.0);
      expect(result.measures[1].time).toBeCloseTo(2.0);
      expect(result.measures[1].duration).toBeCloseTo(4.0);
      expect(result.measures[1].beats[0].duration).toBeCloseTo(1.0);
      expect(result.duration).toBeCloseTo(6.0);
    });

    it("applies a tempo change mid-measure starting on that beat", () => {
      // M0: beat 0 at 120 BPM -> 0.5s; beats 1-3 at 60 BPM -> 1.0s each; duration 3.5s
      // M1 inherits 60 BPM -> 4 × 1.0s = 4.0s, starts at 3.5s
      const result = compile(song(
        measure([beat(), beat(tempo60), ...beats(2)]),
        measure(beats(4)),
      ));

      expect(result.measures[0].beats[0].duration).toBeCloseTo(0.5);
      expect(result.measures[0].beats[1].duration).toBeCloseTo(1.0);
      expect(result.measures[0].duration).toBeCloseTo(3.5);
      expect(result.measures[1].time).toBeCloseTo(3.5);
      expect(result.measures[1].duration).toBeCloseTo(4.0);
      expect(result.duration).toBeCloseTo(7.5);
    });
  });

  describe("time signature changes", () => {
    const timeSig34: TimeSignatureChangeDirection = {
      type: "timeSignatureChange",
      value: { beats: 3, denominator: 4 },
    };

    it("annotates beats with the active time signature and carries changes across measures", () => {
      // Beat 0 of m0: default 4/4; beat 1 changes to 3/4 and propagates through m1
      const result = compile(song(
        measure([beat(), beat(timeSig34), ...beats(2)]),
        measure(beats(4)),
      ));

      expect(result.measures[0].beats[0].timeSignature).toEqual(DefaultTimeSignature);
      expect(result.measures[0].beats[1].timeSignature).toEqual(timeSig34.value);
      expect(result.measures[0].beats[2].timeSignature).toEqual(timeSig34.value);
      expect(result.measures[1].beats[0].timeSignature).toEqual(timeSig34.value);
    });
  });

  describe("markers", () => {
    const marker: MarkerDirection = { type: "marker", value: "Verse" };

    it("marker on the first measure is present on m0 only", () => {
      const result = compile(song(
        measure(beats(4), marker),
        measure(beats(4)),
        measure(beats(4)),
      ));

      expect(result.measures[0].marker?.sourceDirection).toEqual(marker);
      expect(result.measures[0].marker?.measureIndex).toBe(0);
      expect(result.measures[1].marker).toBeUndefined();
      expect(result.measures[2].marker).toBeUndefined();

      expect(result.markers).toHaveLength(1);
      expect(result.markers[0].sourceDirection).toEqual(marker);
      expect(result.markers[0].measureIndex).toBe(0);
    });

    it("marker on the second measure is present on m1 only", () => {
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4), marker),
        measure(beats(4)),
      ));

      expect(result.measures[0].marker).toBeUndefined();
      expect(result.measures[1].marker?.sourceDirection).toEqual(marker);
      expect(result.measures[1].marker?.measureIndex).toBe(1);
      expect(result.measures[2].marker).toBeUndefined();
    });

    it("marker on the third measure is present on m2 only", () => {
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4)),
        measure(beats(4), marker),
      ));

      expect(result.measures[0].marker).toBeUndefined();
      expect(result.measures[1].marker).toBeUndefined();
      expect(result.measures[2].marker?.sourceDirection).toEqual(marker);
      expect(result.measures[2].marker?.measureIndex).toBe(2);
    });
  });

  describe("cuts", () => {
    const cut3: CutDirection = { type: "cut", length: 3 };
    const cut1: CutDirection = { type: "cut", length: 1 };
    const cut2: CutDirection = { type: "cut", length: 2 };

    it("places a cut on the center 3 measures of a 5-measure song", () => {
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4), cut3),
        measure(beats(4)),
        measure(beats(4)),
        measure(beats(4)),
      ));

      // Cuts list
      expect(result.cuts).toHaveLength(1);
      expect(result.cuts[0].inMeasureIndex).toBe(1);
      expect(result.cuts[0].outMeasureIndex).toBe(4);
      expect(result.cuts[0].sourceDirection).toEqual(cut3);

      // Cut field present only within the region (spot-check boundaries)
      expect(result.measures[0].cut).toBeUndefined();
      expect(result.measures[1].cut).toBe(result.cuts[0]);
      expect(result.measures[3].cut).toBe(result.cuts[0]);
      expect(result.measures[4].cut).toBeUndefined();

      // Jump on beat 0 of the first cut measure, targeting the out measure
      expect(result.measures[1].beats[0].jumps).toHaveLength(1);
      expect(result.measures[1].beats[0].jumps[0]).toEqual({
        type: "cut",
        targetIndex: { measure: 4, beat: 0 },
        cutIndex: 0,
      });
      expect(result.measures[1].beats[1].jumps).toHaveLength(0);
    });

    it("cut starting on the first measure", () => {
      const result = compile(song(
        measure(beats(4), cut2),
        measure(beats(4)),
        measure(beats(4)),
      ));

      expect(result.cuts[0].inMeasureIndex).toBe(0);
      expect(result.cuts[0].outMeasureIndex).toBe(2);
      expect(result.measures[0].cut).toBe(result.cuts[0]);
      expect(result.measures[2].cut).toBeUndefined();
      expect(result.measures[0].beats[0].jumps[0]).toEqual({
        type: "cut",
        targetIndex: { measure: 2, beat: 0 },
        cutIndex: 0,
      });
    });

    it("cut ending on the last real measure", () => {
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4)),
        measure(beats(4), cut1),
      ));

      expect(result.cuts[0].inMeasureIndex).toBe(2);
      expect(result.cuts[0].outMeasureIndex).toBe(3);
      expect(result.measures[2].cut).toBe(result.cuts[0]);
      expect(result.measures[3].cut).toBeUndefined();
      expect(result.measures[2].beats[0].jumps[0]).toEqual({
        type: "cut",
        targetIndex: { measure: 3, beat: 0 },
        cutIndex: 0,
      });
    });

    it("throws SongStructureError when a cut extends past the end of the song", () => {
      const cutPastEnd: CutDirection = { type: "cut", length: 5 };

      expect(() => compile(song(
        measure(beats(4), cutPastEnd),
        measure(beats(4)),
      ))).toThrow(SongStructureError);
    });

    it("throws SongStructureError when two cuts overlap", () => {
      expect(() => compile(song(
        measure(beats(4), cut3),
        measure(beats(4), cut2),
        measure(beats(4)),
        measure(beats(4)),
      ))).toThrow(SongStructureError);
    });
  });

  describe("counted repeats", () => {
    function repeat(length: number, iterations: number): RepeatDirection {
      return { type: "repeat", length, exit: { type: "count", iterations }, safety: false };
    }

    it("places a counted repeat on the center 3 measures of a 5-measure song", () => {
      const repeatDir = repeat(3, 2);
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4), repeatDir),
        measure(beats(4)),
        measure(beats(4)),
        measure(beats(4)),
      ));

      // Repeats list
      expect(result.repeats).toHaveLength(1);
      expect(result.repeats[0].inMeasureIndex).toBe(1);
      expect(result.repeats[0].outMeasureIndex).toBe(4);
      expect(result.repeats[0].sourceDirection).toEqual(repeatDir);

      // Repeat field present only within the region (spot-check boundaries)
      expect(result.measures[0].repeat).toBeUndefined();
      expect(result.measures[1].repeat).toBe(result.repeats[0]);
      expect(result.measures[3].repeat).toBe(result.repeats[0]);
      expect(result.measures[4].repeat).toBeUndefined();

      // Jump on beat 0 of the out measure, back to beat 0 of the in measure
      expect(result.measures[4].beats[0].jumps).toHaveLength(1);
      expect(result.measures[4].beats[0].jumps[0]).toEqual({
        type: "repeat",
        targetIndex: { measure: 1, beat: 0 },
        repeatIndex: 0,
      });
      expect(result.measures[4].beats[1].jumps).toHaveLength(0);

      // No vampExit jumps within the region
      expect(result.measures[2].beats[0].jumps).toHaveLength(0);
    });

    it("repeat starting on the first measure", () => {
      const repeatDir = repeat(2, 2);
      const result = compile(song(
        measure(beats(4), repeatDir),
        measure(beats(4)),
        measure(beats(4)),
      ));

      expect(result.repeats[0].inMeasureIndex).toBe(0);
      expect(result.repeats[0].outMeasureIndex).toBe(2);
      expect(result.measures[0].repeat).toBe(result.repeats[0]);
      expect(result.measures[2].repeat).toBeUndefined();
      expect(result.measures[2].beats[0].jumps[0]).toEqual({
        type: "repeat",
        targetIndex: { measure: 0, beat: 0 },
        repeatIndex: 0,
      });
    });

    it("repeat spanning all real measures places the jump in the final synthetic measure", () => {
      const repeatDir = repeat(3, 2);
      const result = compile(song(
        measure(beats(4), repeatDir),
        measure(beats(4)),
        measure(beats(4)),
      ));

      expect(result.repeats[0].inMeasureIndex).toBe(0);
      expect(result.repeats[0].outMeasureIndex).toBe(3);
      const finalMeasure = result.measures[3];

      expect(finalMeasure.beats[0].jumps).toHaveLength(1);
      expect(finalMeasure.beats[0].jumps[0]).toEqual({
        type: "repeat",
        targetIndex: { measure: 0, beat: 0 },
        repeatIndex: 0,
      });
    });

    it("throws SongStructureError when a repeat extends past the end of the song", () => {
      expect(() => compile(song(
        measure(beats(4), repeat(5, 2)),
        measure(beats(4)),
      ))).toThrow(SongStructureError);
    });

    it("throws SongStructureError when two repeats overlap", () => {
      expect(() => compile(song(
        measure(beats(4), repeat(3, 2)),
        measure(beats(4), repeat(2, 2)),
        measure(beats(4)),
        measure(beats(4)),
      ))).toThrow(SongStructureError);
    });
  });

  describe("repeat and cut intersections", () => {
    function countedRepeat(length: number): RepeatDirection {
      return { type: "repeat", length, exit: { type: "count", iterations: 2 }, safety: false };
    }

    function cutOf(length: number): CutDirection {
      return { type: "cut", length };
    }

    it("throws when a cut is fully within a repeat", () => {
      expect(() => compile(song(
        measure(beats(4), countedRepeat(3)),
        measure(beats(4), cutOf(1)),
        measure(beats(4)),
      ))).toThrow(SongStructureError);
    });

    it("throws when a repeat is fully within a cut", () => {
      expect(() => compile(song(
        measure(beats(4), cutOf(3)),
        measure(beats(4), countedRepeat(1)),
        measure(beats(4)),
      ))).toThrow(SongStructureError);
    });

    it("throws when a cut starts first and a repeat begins within it", () => {
      expect(() => compile(song(
        measure(beats(4), cutOf(2)),
        measure(beats(4), countedRepeat(1)),
      ))).toThrow(SongStructureError);
    });

    it("throws when a repeat starts first and a cut begins within it", () => {
      expect(() => compile(song(
        measure(beats(4), countedRepeat(2)),
        measure(beats(4), cutOf(1)),
      ))).toThrow(SongStructureError);
    });

    it("does not throw when a cut ends exactly where a repeat begins", () => {
      expect(() => compile(song(
        measure(beats(4), cutOf(1)),
        measure(beats(4), countedRepeat(1)),
      ))).not.toThrow();
    });

    it("does not throw when a repeat ends exactly where a cut begins", () => {
      expect(() => compile(song(
        measure(beats(4), countedRepeat(1)),
        measure(beats(4), cutOf(1)),
      ))).not.toThrow();
    });
  });

  describe("vamp repeats", () => {
    function vampRepeat(length: number): RepeatDirection {
      return { type: "repeat", length, exit: { type: "vamp" }, safety: false };
    }

    function anyBarRepeat(length: number, every: number): RepeatDirection {
      return { type: "repeat", length, exit: { type: "vampOutAnyBar", every }, safety: false };
    }

    function anyBeatRepeat(length: number, every: number): RepeatDirection {
      return { type: "repeat", length, exit: { type: "vampOutAnyBeat", every }, safety: false };
    }

    describe("vamp", () => {
      it("places a vampExit only at the first beat of the first measure", () => {
        // Repeat on m0, length 2; out at m2
        const result = compile(song(
          measure(beats(4), vampRepeat(2)),
          measure(beats(4)),
          measure(beats(4)),
        ));

        const outIndex = { measure: 2, beat: 0 };

        // VampExit only at beat 0 of the first measure
        expect(result.measures[0].beats[0].jumps).toHaveLength(1);
        expect(result.measures[0].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });

        // No vampExit on subsequent beats of m0 or any beat of m1
        expect(result.measures[0].beats[1].jumps).toHaveLength(0);
        expect(result.measures[1].beats[0].jumps).toHaveLength(0);

        // Regular repeat jump at out measure
        expect(result.measures[2].beats[0].jumps).toHaveLength(1);
        expect(result.measures[2].beats[0].jumps[0]).toEqual({ type: "repeat", targetIndex: { measure: 0, beat: 0 }, repeatIndex: 0 });
      });
    });

    describe("vampOutAnyBar", () => {
      it("exits at beat 0 of every measure when every=1", () => {
        // Repeat on m0, length 3; out at m3
        const result = compile(song(
          measure(beats(4), anyBarRepeat(3, 1)),
          measure(beats(4)),
          measure(beats(4)),
          measure(beats(4)),
        ));

        const outIndex = { measure: 3, beat: 0 };
        const vampExit = { type: "vampExit", targetIndex: outIndex, repeatIndex: 0 };

        expect(result.measures[0].beats[0].jumps[0]).toEqual(vampExit);
        expect(result.measures[1].beats[0].jumps[0]).toEqual(vampExit);
        expect(result.measures[2].beats[0].jumps[0]).toEqual(vampExit);

        // No exit on non-first beats
        expect(result.measures[0].beats[1].jumps).toHaveLength(0);
      });

      it("exits at beat 0 of every 2nd measure when every=2", () => {
        // Repeat on m0, length 4; out at m4
        const result = compile(song(
          measure(beats(4), anyBarRepeat(4, 2)),
          measure(beats(4)),
          measure(beats(4)),
          measure(beats(4)),
          measure(beats(4)),
        ));

        const outIndex = { measure: 4, beat: 0 };

        // MeasuresIntoVamp 0 and 2 → exits; 1 and 3 → no exits
        expect(result.measures[0].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
        expect(result.measures[1].beats[0].jumps).toHaveLength(0);
        expect(result.measures[2].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
        expect(result.measures[3].beats[0].jumps).toHaveLength(0);
      });

      it("counts measures relative to the repeat start, not the song start", () => {
        // Repeat starts at m2 with every=2; exits at m2 and m4, not m3
        const result = compile(song(
          measure(beats(4)),
          measure(beats(4)),
          measure(beats(4), anyBarRepeat(3, 2)),
          measure(beats(4)),
          measure(beats(4)),
          measure(beats(4)),
        ));

        const outIndex = { measure: 5, beat: 0 };

        // MeasuresIntoVamp: m2→0 (exit), m3→1 (no exit), m4→2 (exit)
        expect(result.measures[2].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
        expect(result.measures[3].beats[0].jumps).toHaveLength(0);
        expect(result.measures[4].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
      });
    });

    describe("vampOutAnyBeat", () => {
      it("exits at every beat when every=1", () => {
        // Repeat on m0, length 1; out at m1
        const result = compile(song(
          measure(beats(4), anyBeatRepeat(1, 1)),
          measure(beats(4)),
        ));

        const outIndex = { measure: 1, beat: 0 };

        expect(result.measures[0].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
        expect(result.measures[0].beats[3].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
      });

      it("exits at every 2nd beat per measure, with the counter restarting each bar", () => {
        // Repeat on m0, length 2; out at m2
        const result = compile(song(
          measure(beats(4), anyBeatRepeat(2, 2)),
          measure(beats(4)),
          measure(beats(4)),
        ));

        const outIndex = { measure: 2, beat: 0 };

        // Beats 0 and 2 exit, beats 1 and 3 do not - counter restarts on m1
        expect(result.measures[0].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
        expect(result.measures[0].beats[1].jumps).toHaveLength(0);
        expect(result.measures[0].beats[2].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
        expect(result.measures[0].beats[3].jumps).toHaveLength(0);
        expect(result.measures[1].beats[0].jumps[0]).toEqual({ type: "vampExit", targetIndex: outIndex, repeatIndex: 0 });
        expect(result.measures[1].beats[1].jumps).toHaveLength(0);
      });
    });
  });
});
