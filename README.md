# scoresync

## Overview

**ChoirChaos** is a web app for choir/musical theatre directors. It plays back synchronized MIDI audio for a show's sheet music, while scrolling a PDF score in sync. A **Show** contains **Songs**, each of which has a list of **Measures**, **Tracks** (audio channels), and **Directions** — events attached to measure positions that control playback navigation (repeats, cuts, vamps/holds, tempo changes, etc.).

**scoresync** is the extracted core library. The envisioned architecture has five distinct concerns:

1. **Data model** — the `Show → Song → Measure → Direction` hierarchy, the pure declarative "what is this show"
2. **Playback engine** — tracks playback time and position, interprets direction events (jumps, loops, tempo), emits position updates; completely decoupled from any audio technology
3. **MIDI player** — parses MIDI files and synthesizes audio, synced to the playback engine
4. **Audio player** — an alternate/complementary audio layer (e.g. Web Audio synthesis), also synced to the engine
5. **Score (PDF) sync** — renders PDF pages and maps playback position to a measure coordinate on screen; currently lives in the Vue frontend

Additionally, the `utils/` directory needs a cleanup: music-theory-specific types (`Tempo`, `TimeSignature`, `NoteValue`, `Numbering`) are currently scattered with generic algorithmic utilities.

---

## Proposed Directory Structure

```
src/
├── model/
│   ├── show.ts
│   ├── song.ts
│   ├── measure.ts
│   ├── track.ts
│   └── direction/
│       ├── index.ts
│       ├── base.ts
│       ├── marker.ts
│       ├── repeat.ts
│       ├── cut.ts
│       ├── vamp.ts
│       ├── tempoChange.ts
│       └── timeSignatureChange.ts
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
├── music/
│   ├── index.ts
│   ├── noteValue.ts
│   ├── tempo.ts
│   ├── timeSignature.ts
│   └── numbering.ts  (+.test.ts)
│
└── utils/
    ├── binarySearch.ts  (+.test.ts)
    ├── json.ts
    ├── jobCache.ts
    └── updater.ts
```

---

## Detailed Plan

### `model/` — Pure data, no side effects

**Principle:** No PocketBase, no MIDI ticks, no layout coordinates. The model describes *what a show is*, not how it is stored or played back. This is the main change from the current `src/core/models/` where `Song` and `Show` embed database operations (`fromRecord()`, `create()`, `list()`, etc.) and `Measure` carries layout coordinates (`MeasureLayout`) and computed MIDI state (`$beatTicks`, `$tickLength`).

- **`show.ts`** — `Show` class: `id`, `title`, `thumbnail?: UrlOrFile`, `songs: Song[]`. Constructor sorts by song number.
- **`song.ts`** — `Song` class: `id`, `number: SongNumber`, `title`, `measures: MeasureList`, `tracks: Track[]`, `events: SongEvents` (markers, repeats, cuts, vamps, jumps, segue flag). The `SongEvents` type and `MeasureEventList` class (currently undefined in `modelsV2/song.ts`) get properly defined here. No file references (`midiFile`, `pdfFile`) — those belong in the app layer.
- **`measure.ts`** — `Measure` class: `number: MeasureNumber`, `beats: number`. No layout, no ticks — just the musical data. `MeasureList`, `MeasureReference`, comparators stay here.
- **`track.ts`** — `Track` class: `title`, `classification: TrackClassification`, `midiProgramNumber`. Mixer state (mute, solo, gain) is **removed** from the model — that's runtime playback state, not data. The MIDI/audio players manage their own mixer state.
- **`direction/`** — copied from `modelsV2/direction/` largely as-is. `MeasureEventList` (the `DirectionList`) lives in `base.ts`. All seven direction types remain. The `index.ts` re-exports all public types.

---

### `engine/` — The central playback brain

**Principle:** The engine knows about the Song (to read directions and measure structure) but knows *nothing* about audio, MIDI, or rendering. It is the single source of truth for "where are we in the playback right now". Everything else subscribes to it.

- **`position.ts`** — `PlaybackPosition` type: `{ measure: MeasureNumber, beat: BeatNumber, tick: Tick, time: number }`. Also `PlaybackTick` (a pre-computed mapping from logical ticks to wall-clock seconds, accounting for tempo changes).
- **`state.ts`** — `EngineStatus` enum (`stopped | playing | paused`), `EngineVampState` (whether a vamp is active, iteration count, whether manual exit was requested), `EngineEvents` (the full event map the engine emits: `statusChanged`, `positionChanged`, `measureChanged`, `tempoChanged`, `timeSignatureChanged`, `vampChanged`, `segueReached`).
- **`timeline.ts`** — `Timeline` class. This is the critical new abstraction. It takes a `Song` (for direction events and measure beat counts) plus a `TempoMap` (tick→BPM, derived from the MIDI file or set manually) and pre-computes: the tick position of every measure boundary, the wall-clock time of every tick (applying all tempo changes), and a sorted index so the engine can seek efficiently. The current `MidiPlayer` does this computation inline while parsing; extracting it makes it reusable and testable.
- **`engine.ts`** — `PlaybackEngine` class. Owns an `Updater` for its tick loop. On each update, advances the tick counter (scaled by playback speed and tempo), checks for direction events in order, dispatches them (jumping ticks for repeats/cuts, looping for vamps), and emits position events. Key interface: `load(song, timeline)`, `play()`, `pause()`, `stop()`, `seek(position)`, `setSpeed(factor)`, `exitVamp()`. This replaces the direction-handling logic currently scattered through `MidiPlayer`.

---

### `midi/` — MIDI data layer + MIDI-synced playback

**Principle:** Split the current monolithic `MidiPlayer` into two responsibilities: parsing (pure data transformation) and playing (audio output, synced to the engine).

- **`types.ts`** — `Tick` branded number type. Keep separate from `music/` because MIDI ticks are a MIDI format concept, not music theory.
- **`events.ts`** — `NoteEvent`, `TempoEvent`, `TimeSignatureEvent`, `MeasureEvent`, `MidiEventList<T>`. Largely unchanged from current `midi/events.ts`.
- **`parser.ts`** — New file, extracted from `MidiPlayer.load()`. Takes a MIDI file (URL or `File`), parses it with `midi-json-parser`, and returns a structured `MidiData` object: `{ systemEvents: MidiEventList, trackEvents: MidiTrackEvents[], tempoMap: TempoMap }`. This is now a pure async function, not a method on a stateful class. The `TempoMap` it returns is what `engine/timeline.ts` needs.
- **`player.ts`** — `MidiPlayer` class. Subscribes to the `PlaybackEngine`'s `positionChanged` and `noteTriggered` events. Manages the Web Audio context, WebAudioFontPlayer, compressor, EQ. Owns track-level mixer state (mute/solo/gain per track index) since that's playback state, not model state. Much simpler than today because time tracking and direction logic live in the engine.

---

### `audio/` — Web Audio synthesis (future, stub now)

**Principle:** A non-MIDI audio player that can be synced to the engine — for example, playing back pre-recorded audio stems rather than synthesized MIDI. This doesn't exist yet in the codebase but is part of the vision.

- **`player.ts`** — `AudioPlayer` stub: subscribes to `PlaybackEngine`, plays/pauses/seeks audio buffers.
- **`mixer.ts`** — The master audio chain (compressor, 3-band EQ) can be shared between `MidiPlayer` and `AudioPlayer`; extract it here.
- **`soundFont.ts`** — WebAudioFont integration isolated from `MidiPlayer`.

---

### `score/` — PDF rendering + position sync

**Principle:** Bring the PDF/score logic out of the Vue frontend into the library. The Vue component currently knows about measure layout positions and handles scroll sync — that logic belongs here.

- **`layout.ts`** — `MeasureLayout` type: `{ page, x, y, width, height }`. Currently on the `Measure` model, it should live here. Also `MeasureLayoutMap` (a lookup from `MeasureNumber` to `MeasureLayout`). Layout is loaded separately from the model (it comes from the `staffsV1` format file).
- **`renderer.ts`** — `PdfRenderer` class, directly from `src/core/pdf/pdfRenderer.ts`. Manages the Web Worker, `JobCache`, page status events.
- **`worker/pdfRender.worker.ts`** — Unchanged from current.
- **`pageTransform.ts`** — `PageTransform` class, directly from `src/core/pdf/pageTransform.ts`. Coordinate system for zoom/pan/page layout.
- **`sync.ts`** — `ScoreSync` class. New. Subscribes to `PlaybackEngine` `measureChanged` events, looks up the current measure in a `MeasureLayoutMap`, and emits a scroll target. Currently this is done imperatively in Vue component code.

---

### `formats/` — External file format adapters

**Principle:** Reading MTI files and staffs layout files is an import concern. The parsers transform external formats into the internal model types. They don't belong in `model/` (which should be independent of any specific file format) or in `utils/` (too domain-specific).

- **`mti/types.ts`** — Raw MTI JSON types, moved from `src/core/scripts/jsonTypes/mti.ts`.
- **`mti/parser.ts`** — Parses `MTIShow` → `{ show: Show, songs: Song[], tracks: Track[][] }`. Currently this parsing is done inline in the frontend or bundlemti script.
- **`staffsV1/types.ts`** — `StaffsV1` type, from `src/core/scripts/jsonTypes/staffsV1.ts`.
- **`staffsV1/parser.ts`** — Parses `StaffsV1` → `MeasureLayoutMap`. Currently done in the frontend.

---

### `music/` — Music theory primitives (the big cleanup)

**Principle:** All types that model music-theory concepts should live together, separately from algorithmic utilities. Currently `noteValue.ts`, `tempo.ts`, `timeSignature.ts`, and `numbering.ts` all live in `utils/` alongside `binarySearch.ts` and `json.ts` — completely different kinds of things.

- **`noteValue.ts`** — `NoteValue`, `NoteType`, all predefined note constants. Unchanged content.
- **`tempo.ts`** — `Tempo` type. Updates its import of `NoteValue` to come from `./noteValue.js`.
- **`timeSignature.ts`** — `TimeSignature`, `BeatType`. Unchanged.
- **`numbering.ts`** — `Numbering` branded type, `isNumbering()`, `asNumbering()`, `compareNumberings()`. Moved from `utils/`. Since measure numbering is a domain concept (it describes how measures in a score are labeled), it belongs in `music/` rather than `utils/`. The test file moves with it.
- **`index.ts`** — Re-exports everything for convenient `import ... from 'scoresync/music'` usage.

---

### `utils/` — True generics only

After the music-theory types move out, only these remain:

- **`binarySearch.ts`** — `binarySearch()`, `insertSorted()`, `BinarySortedList`. Pure algorithms with no domain knowledge.
- **`json.ts`** — `JsonSerializable`, `JsonSerializableConstructor` interfaces.
- **`jobCache.ts`** — `JobCache` generic async job cache, moved from `pdf/jobCache.ts`.
- **`updater.ts`** — `Updater`, `SetIntervalUpdater`, `AnimationFrameUpdater`. Frame-rate independent loop abstraction.

---

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Remove DB from model | `Song`/`Show` having `fromRecord()`/`create()` couples the library to PocketBase. The app layer handles persistence. |
| Remove layout from `Measure` | `MeasureLayout` is a display concern, not a musical one. Score rendering reads it from `score/layout.ts`. |
| Remove mixer state from `Track` | Mute/solo/gain are runtime playback state, not persistent data. MIDI/audio players own this. |
| Extract `parser.ts` from `MidiPlayer` | MIDI parsing is a pure function; keeping it in a stateful class makes it untestable. |
| `Timeline` as a separate class | Pre-computing tick↔time mapping makes seeking and the direction engine efficient and independently testable. |
| `formats/` for external schemas | MTI and staffsV1 are import-only concerns; isolating them means the core model is format-agnostic. |
| `music/` for theory types | Groups domain primitives together; `utils/` becomes truly generic. |
| `engine/` emits events, players subscribe | Clean inversion of control — the engine doesn't know about audio, audio doesn't control time. |
