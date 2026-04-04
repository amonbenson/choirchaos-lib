# scoresync

## Overview

**ChoirChaos** is a web app for choir/musical theatre directors. It plays back synchronized MIDI audio for a show's sheet music, while scrolling a PDF score in sync. A **Show** contains **Songs**, each of which has a list of **Measures**, each containing **Beats** — and each Beat carries **Directions** (events that control playback navigation: repeats, cuts, vamps/holds, tempo changes, etc.).

**scoresync** is the extracted core library. The architecture has five distinct concerns:

1. **Data model** — the `Show → Song → Measure → Beat → Direction` hierarchy, the pure declarative "what is this show"
2. **Playback engine** — tracks playback time and position, interprets direction events (jumps, loops, tempo), emits position updates; completely decoupled from any audio technology
3. **MIDI player** — parses MIDI files and synthesizes audio, synced to the playback engine
4. **Audio player** — an alternate/complementary audio layer (e.g. Web Audio synthesis), also synced to the engine
5. **Score (PDF) sync** — renders PDF pages and maps playback position to a measure coordinate on screen

---

## Current Directory Structure

```
src/
├── model/
│   ├── beat.ts
│   ├── direction.ts
│   ├── measure.ts
│   ├── measureReference.ts
│   ├── show.ts
│   └── song.ts
│
├── music/
│   ├── index.ts
│   ├── noteValue.ts
│   ├── numbering.ts  (+.test.ts)
│   ├── tempo.ts
│   └── timeSignature.ts
│
└── utils/
    ├── binarySearch.ts  (+.test.ts)
    ├── brand.ts
    ├── file.ts
    └── json.ts
```

The following modules are planned but not yet implemented: `engine/`, `midi/`, `audio/`, `score/`, `formats/`.

---

## Planned Directory Structure

```
src/
├── model/          ← implemented
│   └── ...
│
├── engine/
│   ├── engine.ts
│   ├── timeline.ts
│   ├── position.ts
│   └── state.ts
│
├── midi/
│   ├── types.ts
│   ├── events.ts
│   ├── parser.ts
│   └── player.ts
│
├── audio/
│   ├── player.ts
│   ├── mixer.ts
│   └── soundFont.ts
│
├── score/
│   ├── renderer.ts
│   ├── sync.ts
│   ├── layout.ts
│   ├── pageTransform.ts
│   └── worker/
│       └── pdfRender.worker.ts
│
├── formats/
│   ├── mti/
│   │   ├── types.ts
│   │   └── parser.ts
│   └── staffsV1/
│       ├── types.ts
│       └── parser.ts
│
├── music/          ← implemented
│   └── ...
│
└── utils/          ← implemented
    └── ...
```

---

## Implemented Modules

### `model/` — Pure data, no side effects

All model types are plain TypeScript objects (no classes). Factory functions provide default values.

- **`beat.ts`** — `BeatNumber` (plain `number`), `Beat` type: `{ directions: MeasureDirection[] }`. Directions are attached at the beat level within a measure.
- **`direction.ts`** — `MeasureDirection` is a discriminated union of six concrete direction types: `Marker`, `Repeat`, `Vamp`, `Cut`, `TempoChange`, `TimeSignatureChange`. Each type carries only its own fields — no shared base type. `SongDirection` is a separate union for song-level directions, currently containing only `Segue`.
- **`measure.ts`** — `MeasureNumber` (branded `Numbering`), `Measure` type: `{ number, beats: Beat[] }`. Comparator `compareMeasures` for sorting.
- **`measureReference.ts`** — `MeasureReference` tuple `[MeasureNumber, BeatNumber]`. `asMeasureReference()` validates and constructs from raw input. `compareMeasureReferences()` for sorting.
- **`show.ts`** — `ShowId` (branded string), `Show` type: `{ id, title, thumbnail?, songs }`. `createShow()` factory with defaults.
- **`song.ts`** — `SongId`, `SongNumber` (branded types), `Song` type: `{ id, number, title, measures, directions }`. `createSong()` factory with defaults.

### `music/` — Music theory primitives

- **`noteValue.ts`** — `NoteValue`, `NoteType`, predefined note constants (`WholeNote`, `QuarterNote`, etc.).
- **`tempo.ts`** — `Tempo`: `{ bpm, pulse: NoteValue }`.
- **`timeSignature.ts`** — `TimeSignature`: `{ beats, denominator: BeatType }`. `BeatType` is a union of valid power-of-two denominators.
- **`numbering.ts`** — `Numbering` branded string type for measure/song labels like `"1"`, `"2a"`, `"10a-2"`. `isNumbering()`, `asNumbering()`, `compareNumberings()`.
- **`index.ts`** — Re-exports everything for `import ... from '@/music'`.

### `utils/` — Generic utilities

- **`binarySearch.ts`** — `binarySearch()`, `insertSorted()`, `BinarySortedList`. Pure algorithms with no domain knowledge.
- **`brand.ts`** — `Branded<T, K>` utility type for nominal typing. Usage: `type MeasureNumber = Branded<Numbering, "MeasureNumber">`.
- **`file.ts`** — `UrlOrFile = string | File`.
- **`json.ts`** — `JsonValue`, `JsonObject`, `JsonSerializable`, `JsonSerializableConstructor` interfaces.

---

## Planned Modules

### `engine/` — The central playback brain

The engine knows about the Song (to read directions and measure structure) but knows nothing about audio, MIDI, or rendering. It is the single source of truth for "where are we in playback right now". Everything else subscribes to it.

- **`position.ts`** — `PlaybackPosition`: `{ measure, beat, tick, time }`. `PlaybackTick` maps logical ticks to wall-clock seconds accounting for tempo changes.
- **`state.ts`** — `EngineStatus` enum (`stopped | playing | paused`), `EngineVampState`, `EngineEvents` (the full event map: `statusChanged`, `positionChanged`, `measureChanged`, `tempoChanged`, `timeSignatureChanged`, `vampChanged`, `segueReached`).
- **`timeline.ts`** — `Timeline` class. Takes a `Song` and a `TempoMap` and pre-computes tick positions for every measure boundary and wall-clock times for every tick. Enables efficient seeking.
- **`engine.ts`** — `PlaybackEngine` class. Owns the tick loop. Advances position, dispatches direction events (jumps for repeats/cuts, looping for vamps), emits position events. Interface: `load(song, timeline)`, `play()`, `pause()`, `stop()`, `seek(position)`, `setSpeed(factor)`, `exitVamp()`.

### `midi/` — MIDI data layer + MIDI-synced playback

- **`types.ts`** — `Tick` branded number type (MIDI-format concept, distinct from music theory).
- **`events.ts`** — `NoteEvent`, `TempoEvent`, `TimeSignatureEvent`, `MeasureEvent`, `MidiEventList<T>`.
- **`parser.ts`** — Pure async function: takes a MIDI file, parses it, returns `MidiData`: `{ systemEvents, trackEvents, tempoMap }`.
- **`player.ts`** — `MidiPlayer` class. Subscribes to `PlaybackEngine` events. Manages Web Audio context, WebAudioFontPlayer, compressor, EQ. Owns track-level mixer state (mute/solo/gain) since that is playback state, not model state.

### `audio/` — Web Audio synthesis (future)

- **`player.ts`** — `AudioPlayer` stub: subscribes to `PlaybackEngine`, plays/pauses/seeks audio buffers.
- **`mixer.ts`** — Master audio chain (compressor, EQ) shared between `MidiPlayer` and `AudioPlayer`.
- **`soundFont.ts`** — WebAudioFont integration isolated from `MidiPlayer`.

### `score/` — PDF rendering + position sync (future)

- **`layout.ts`** — `MeasureLayout`: `{ page, x, y, width, height }`. `MeasureLayoutMap` lookup from `MeasureNumber` to `MeasureLayout`.
- **`renderer.ts`** — `PdfRenderer` class. Manages the Web Worker, `JobCache`, page status events.
- **`worker/pdfRender.worker.ts`** — PDF.js render worker.
- **`pageTransform.ts`** — `PageTransform` class. Coordinate system for zoom/pan/page layout.
- **`sync.ts`** — `ScoreSync` class. Subscribes to `PlaybackEngine` `measureChanged` events, looks up the current measure in a `MeasureLayoutMap`, emits a scroll target.

### `formats/` — External file format adapters (future)

- **`mti/types.ts`** — Raw MTI JSON types.
- **`mti/parser.ts`** — Parses `MTIShow` → `{ show, songs, tracks }`.
- **`staffsV1/types.ts`** — `StaffsV1` type.
- **`staffsV1/parser.ts`** — Parses `StaffsV1` → `MeasureLayoutMap`.

---

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Plain types, not classes | Trivial serialization, easy to spread/override in tests, no `instanceof` surprises across serialization boundaries |
| Factory functions for defaults | `createSong()`, `createShow()` provide default values without class constructors; callers can spread and override individual fields |
| `MeasureDirection` as a discriminated union | `switch (d.type)` narrows correctly in each branch with no forward-declaration of valid type strings |
| Directions on `Beat`, not `Measure` | Directions are attached at beat-level granularity, enabling sub-measure precision |
| `Branded<T, K>` for nominal types | Prevents accidentally passing a raw `string` where a `MeasureNumber` is expected, without any runtime cost |
| `music/` separate from `utils/` | Music-theory types (`Tempo`, `TimeSignature`, `NoteValue`, `Numbering`) are domain primitives; `utils/` contains only format-agnostic algorithms |
| `moduleResolution: Bundler` + tsup | Allows extension-free imports and bare directory imports during development; tsup produces proper ESM output with explicit extensions for distribution |
| `@/` path alias | `@/music`, `@/utils/brand` etc. resolve to `src/` — avoids deep relative paths across module boundaries |
| `engine/` emits events, players subscribe | Clean inversion of control — the engine doesn't know about audio; audio doesn't control time |
| `formats/` for external schemas | MTI and staffsV1 are import-only concerns; isolating them keeps the core model format-agnostic |
