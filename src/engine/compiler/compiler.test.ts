import { describe, expect, it } from "vitest";

import { type CutDirection, type MarkerDirection, type RepeatDirection, type TempoChangeDirection, type TimeSignatureChangeDirection } from "@/model/direction";
import { asNumbering, DefaultTempo, DefaultTimeSignature, QuarterNote } from "@/music";
import { beat, beats, measure, song } from "@/test/utils";

import { compile } from "./compiler";
import { SongStructureError } from "./errors";

describe("compile", () => {
  it("compiles an empty song into a single stop frame with default settings", () => {
    const emptySong = song();
    const result = compile(emptySong);

    // Exactly one measure - the synthetic stop measure
    expect(result.frames.length).toBe(1);

    const frame = result.frames[0];

    expect(frame.index).toBe(0);
    expect(frame.measureIndex).toBe(0);
    expect(frame.beatIndex).toBe(0);

    expect(frame.measureNumber).toBe(asNumbering("1"));
    expect(frame.measureFrameIndex).toBe(0);
    expect(frame.measureBeats).toBe(1);

    expect(frame.time).toBe(0);
    expect(frame.duration).toBeCloseTo(0.5); // Default tempo: 120 BPM -> 60/120 = 0.5s per beat

    expect(frame.tempo).toEqual(DefaultTempo);
    expect(frame.timeSignature).toEqual(DefaultTimeSignature);

    expect(frame.marker).toBeUndefined();
    expect(frame.cut).toBeUndefined();
    expect(frame.repeat).toBeUndefined();

    // Stop measure should not be counted
    expect(result.duration).toBe(0);
  });

  it("compiles a 3-measure song with 4 beats each into 12 frames plus a stop frame", () => {
    const result = compile(song(
      measure(beats(4)),
      measure(beats(4)),
      measure(beats(4)),
    ));

    // 3*4 real beats + 1 synthetic stop measure
    expect(result.frames).toHaveLength(13);

    const m0b3 = result.frames[3];
    const m1b0 = result.frames[4];
    const m1b1 = result.frames[5];
    const stopFrame = result.frames[12];

    // Last beat of the first measure
    expect(m0b3.index).toBe(3);
    expect(m0b3.measureIndex).toBe(0);
    expect(m0b3.beatIndex).toBe(3);

    expect(m0b3.measureNumber).toBe(asNumbering("1"));
    expect(m0b3.measureFrameIndex).toBe(0);
    expect(m0b3.measureBeats).toBe(4);

    expect(m0b3.time).toBeCloseTo(1.5);
    expect(m0b3.duration).toBeCloseTo(0.5);

    // First beat of the second measure
    expect(m1b0.index).toBe(4);
    expect(m1b0.measureIndex).toBe(1);
    expect(m1b0.beatIndex).toBe(0);

    expect(m1b0.measureNumber).toBe(asNumbering("2"));
    expect(m1b0.measureFrameIndex).toBe(4);
    expect(m1b0.measureBeats).toBe(4);

    expect(m1b0.time).toBeCloseTo(2.0);
    expect(m1b0.duration).toBeCloseTo(0.5);

    // Second beat of the second measure
    expect(m1b1.index).toBe(5);
    expect(m1b1.measureIndex).toBe(1);
    expect(m1b1.beatIndex).toBe(1);

    expect(m1b1.measureNumber).toBe(asNumbering("2"));
    expect(m1b1.measureFrameIndex).toBe(4);
    expect(m1b1.measureBeats).toBe(4);

    expect(m1b1.time).toBeCloseTo(2.5);
    expect(m1b1.duration).toBeCloseTo(0.5);

    // Stop frame
    expect(stopFrame.index).toBe(12);
    expect(stopFrame.measureIndex).toBe(3);
    expect(stopFrame.beatIndex).toBe(0);

    expect(stopFrame.measureNumber).toBe(asNumbering("4"));
    expect(stopFrame.measureFrameIndex).toBe(12);
    expect(stopFrame.measureBeats).toBe(1);

    expect(stopFrame.time).toBeCloseTo(6.0);
    expect(stopFrame.duration).toBeCloseTo(0.5);

    // Song duration = 3 * 2s
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

      expect(result.frames[0].duration).toBeCloseTo(1.0);

      expect(result.frames[0].time).toBeCloseTo(0.0);
      expect(result.frames[4].time).toBeCloseTo(4.0);
      expect(result.duration).toBeCloseTo(8.0);
    });

    it("applies a tempo change on beat 0 of a later measure from that measure onwards", () => {
      // M0: 120 BPM -> 4 × 0.5s = 2.0s; m1: 60 BPM -> 4 × 1.0s = 4.0s
      const result = compile(song(
        measure(beats(4)),
        measure([beat(tempo60), ...beats(3)]),
      ));

      expect(result.frames[0].time).toBeCloseTo(0.0); // First measure
      expect(result.frames[4].time).toBeCloseTo(2.0); // Second measure (60 BPM)
      expect(result.duration).toBeCloseTo(6.0);
    });

    it("applies a tempo change mid-measure starting on that beat", () => {
      // M0: beat 0 at 120 BPM -> 0.5s; beats 1-3 at 60 BPM -> 1.0s each; duration 3.5s
      // M1 inherits 60 BPM -> 4 × 1.0s = 4.0s, starts at 3.5s
      const result = compile(song(
        measure([beat(), beat(tempo60), ...beats(2)]),
        measure(beats(4)),
      ));

      expect(result.frames[0].time).toBeCloseTo(0.0); // First measure
      expect(result.frames[1].time).toBeCloseTo(0.5); // To 60 BPM
      expect(result.frames[2].time).toBeCloseTo(1.5);
      expect(result.frames[4].time).toBeCloseTo(3.5); // Second measure
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

      expect(result.frames[0].timeSignature).toEqual(DefaultTimeSignature);
      expect(result.frames[1].timeSignature).toEqual(timeSig34.value);
      expect(result.frames[2].timeSignature).toEqual(timeSig34.value);
      expect(result.frames[4].timeSignature).toEqual(timeSig34.value);
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

      expect(result.frames[0].marker?.sourceDirection).toEqual(marker);
      expect(result.frames[0].marker?.frameIndex).toBe(0);
      expect(result.frames[1].marker?.frameIndex).toBe(0);
      expect(result.frames[4].marker).toBeUndefined();

      expect(result.markers).toHaveLength(1);
      expect(result.markers[0].sourceDirection).toEqual(marker);
      expect(result.markers[0].frameIndex).toBe(0);
    });

    it("marker on the second measure is present on m1 only", () => {
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4), marker),
        measure(beats(4)),
      ));

      expect(result.frames[3].marker).toBeUndefined();
      expect(result.frames[4].marker?.frameIndex).toBe(4);
      expect(result.frames[7].marker?.frameIndex).toBe(4);
      expect(result.frames[8].marker).toBeUndefined();
    });

    it("marker on the third measure is present on m2 only", () => {
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4)),
        measure(beats(4), marker),
      ));

      expect(result.frames[0].marker).toBeUndefined();
      expect(result.frames[7].marker).toBeUndefined();
      expect(result.frames[8].marker?.frameIndex).toBe(8);
      expect(result.frames[11].marker?.frameIndex).toBe(8);
    });
  });

  describe("cuts", () => {
    const cut1: CutDirection = { type: "cut", length: 1 };
    const cut2: CutDirection = { type: "cut", length: 2 };
    const cut3: CutDirection = { type: "cut", length: 3 };

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
      expect(result.cuts[0].inFrameIndex).toBe(4);
      expect(result.cuts[0].outFrameIndex).toBe(16);
      expect(result.cuts[0].sourceDirection).toEqual(cut3);

      // Cut field present only within the region (spot-check boundaries)
      expect(result.frames[0].cut).toBeUndefined();
      expect(result.frames[4].cut).toBe(result.cuts[0]);
      expect(result.frames[12].cut).toBe(result.cuts[0]);
      expect(result.frames[16].cut).toBeUndefined();

      // Jump on beat 0 of the first cut measure, targeting the out measure
      expect(result.frames[4].jumps).toHaveLength(1);
      expect(result.frames[4].jumps[0]).toEqual({
        type: "cut",
        targetFrameIndex: 16,
        cutIndex: 0,
      });
      expect(result.frames[5].jumps).toHaveLength(0);
    });

    it("cut starting on the first measure", () => {
      const result = compile(song(
        measure(beats(4), cut2),
        measure(beats(4)),
        measure(beats(4)),
      ));

      // 3 measures × 4 beats = 12 real frames; stop measure at frame 12
      // Cut2: in at measure 0 (frame 0), out at measure 2 (frame 8)
      expect(result.cuts[0].inFrameIndex).toBe(0);
      expect(result.cuts[0].outFrameIndex).toBe(8);
      expect(result.frames[0].cut).toBe(result.cuts[0]);
      expect(result.frames[8].cut).toBeUndefined();
      expect(result.frames[0].jumps[0]).toEqual({
        type: "cut",
        targetFrameIndex: 8,
        cutIndex: 0,
      });
    });

    it("cut ending on the last real measure", () => {
      const result = compile(song(
        measure(beats(4)),
        measure(beats(4)),
        measure(beats(4), cut1),
      ));

      // Cut1: in at measure 2 (frame 8), out at stop measure (frame 12)
      expect(result.cuts[0].inFrameIndex).toBe(8);
      expect(result.cuts[0].outFrameIndex).toBe(12);
      expect(result.frames[8].cut).toBe(result.cuts[0]);
      expect(result.frames[12].cut).toBeUndefined();
      expect(result.frames[8].jumps[0]).toEqual({
        type: "cut",
        targetFrameIndex: 12,
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

  describe.todo("counted repeats", () => {
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

      // 5 measures × 4 beats = 20 real frames; stop at frame 20
      // Repeat: in at measure 1 (frame 4), out at measure 4 (frame 16)
      expect(result.repeats).toHaveLength(1);
      expect(result.repeats[0].inFrameIndex).toBe(4);
      expect(result.repeats[0].outFrameIndex).toBe(16);
      expect(result.repeats[0].sourceDirection).toEqual(repeatDir);

      // Repeat field present only within the region (spot-check boundaries)
      expect(result.frames[0].repeat).toBeUndefined();
      expect(result.frames[4].repeat).toBe(result.repeats[0]);
      expect(result.frames[15].repeat).toBe(result.repeats[0]);
      expect(result.frames[16].repeat).toBeUndefined();

      // Jump on beat 0 of the out measure, back to beat 0 of the in measure
      expect(result.frames[16].jumps).toHaveLength(1);
      expect(result.frames[16].jumps[0]).toEqual({
        type: "repeat",
        targetFrameIndex: 4,
        repeatIndex: 0,
      });
      expect(result.frames[17].jumps).toHaveLength(0);

      // No vampExit jumps within the region
      expect(result.frames[8].jumps).toHaveLength(0);
    });

    it("repeat starting on the first measure", () => {
      const repeatDir = repeat(2, 2);
      const result = compile(song(
        measure(beats(4), repeatDir),
        measure(beats(4)),
        measure(beats(4)),
      ));

      // 3 measures × 4 beats = 12 real frames; repeat: in at frame 0, out at measure 2 (frame 8)
      expect(result.repeats[0].inFrameIndex).toBe(0);
      expect(result.repeats[0].outFrameIndex).toBe(8);
      expect(result.frames[0].repeat).toBe(result.repeats[0]);
      expect(result.frames[8].repeat).toBeUndefined();
      expect(result.frames[8].jumps[0]).toEqual({
        type: "repeat",
        targetFrameIndex: 0,
        repeatIndex: 0,
      });
    });

    it("repeat spanning all real measures places the jump in the stop synthetic measure", () => {
      const repeatDir = repeat(3, 2);
      const result = compile(song(
        measure(beats(4), repeatDir),
        measure(beats(4)),
        measure(beats(4)),
      ));

      // 3 measures × 4 beats = 12 real frames; repeat: in at frame 0, out at stop frame (12)
      expect(result.repeats[0].inFrameIndex).toBe(0);
      expect(result.repeats[0].outFrameIndex).toBe(12);
      const stopFrame = result.frames[12];

      expect(stopFrame.jumps).toHaveLength(1);
      expect(stopFrame.jumps[0]).toEqual({
        type: "repeat",
        targetFrameIndex: 0,
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

  describe.todo("repeat and cut intersections", () => {
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

  describe.todo("vamp repeats", () => {
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

        // 3 measures × 4 beats; repeat: in at frame 0, out at frame 8
        // VampExit only at beat 0 of the first measure
        expect(result.frames[0].jumps).toHaveLength(1);
        expect(result.frames[0].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 8, repeatIndex: 0 });

        // No vampExit on subsequent beats of m0 or any beat of m1
        expect(result.frames[1].jumps).toHaveLength(0);
        expect(result.frames[4].jumps).toHaveLength(0);

        // Regular repeat jump at out frame (measure 2, beat 0)
        expect(result.frames[8].jumps).toHaveLength(1);
        expect(result.frames[8].jumps[0]).toEqual({ type: "repeat", targetFrameIndex: 0, repeatIndex: 0 });
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

        // 4 measures × 4 beats; repeat: in at frame 0, out at frame 12
        const vampExit = { type: "vampExit", targetFrameIndex: 12, repeatIndex: 0 };

        expect(result.frames[0].jumps[0]).toEqual(vampExit);
        expect(result.frames[4].jumps[0]).toEqual(vampExit);
        expect(result.frames[8].jumps[0]).toEqual(vampExit);

        // No exit on non-first beats
        expect(result.frames[1].jumps).toHaveLength(0);
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

        // 5 measures × 4 beats; repeat: in at frame 0, out at frame 16
        // MeasuresIntoVamp 0 and 2 → exits; 1 and 3 → no exits
        expect(result.frames[0].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 16, repeatIndex: 0 });
        expect(result.frames[4].jumps).toHaveLength(0);
        expect(result.frames[8].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 16, repeatIndex: 0 });
        expect(result.frames[12].jumps).toHaveLength(0);
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

        // 6 measures × 4 beats; repeat: in at measure 2 (frame 8), out at measure 5 (frame 20)
        // MeasuresIntoVamp: m2→0 (exit), m3→1 (no exit), m4→2 (exit)
        expect(result.frames[8].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 20, repeatIndex: 0 });
        expect(result.frames[12].jumps).toHaveLength(0);
        expect(result.frames[16].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 20, repeatIndex: 0 });
      });
    });

    describe("vampOutAnyBeat", () => {
      it("exits at every beat when every=1", () => {
        // Repeat on m0, length 1; out at m1
        const result = compile(song(
          measure(beats(4), anyBeatRepeat(1, 1)),
          measure(beats(4)),
        ));

        // 2 measures × 4 beats; repeat: in at frame 0, out at frame 4
        expect(result.frames[0].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 4, repeatIndex: 0 });
        expect(result.frames[3].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 4, repeatIndex: 0 });
      });

      it("exits at every 2nd beat per measure, with the counter restarting each bar", () => {
        // Repeat on m0, length 2; out at m2
        const result = compile(song(
          measure(beats(4), anyBeatRepeat(2, 2)),
          measure(beats(4)),
          measure(beats(4)),
        ));

        // 3 measures × 4 beats; repeat: in at frame 0, out at frame 8
        // Beats 0 and 2 exit, beats 1 and 3 do not - counter restarts on m1
        expect(result.frames[0].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 8, repeatIndex: 0 });
        expect(result.frames[1].jumps).toHaveLength(0);
        expect(result.frames[2].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 8, repeatIndex: 0 });
        expect(result.frames[3].jumps).toHaveLength(0);
        expect(result.frames[4].jumps[0]).toEqual({ type: "vampExit", targetFrameIndex: 8, repeatIndex: 0 });
        expect(result.frames[5].jumps).toHaveLength(0);
      });
    });
  });
});
