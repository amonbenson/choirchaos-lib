import { AudioContext, GainNode } from "node-web-audio-api";

// Web Audio API polyfill
Object.assign(globalThis, { AudioContext, GainNode });
