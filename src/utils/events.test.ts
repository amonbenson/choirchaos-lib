import { describe, expect, it, vi } from "vitest";

import { Emitter } from "./events.js";

describe("Emitter", () => {
  it("calls a registered listener with the correct value", () => {
    const emitter = new Emitter<string>();
    const listener = vi.fn();

    emitter.event(listener);
    emitter.fire("hello");

    expect(listener).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("calls multiple listeners", () => {
    const emitter = new Emitter<number>();
    const a = vi.fn();
    const b = vi.fn();

    emitter.event(a);
    emitter.event(b);
    emitter.fire(42);

    expect(a).toHaveBeenCalledWith(42);
    expect(b).toHaveBeenCalledWith(42);
  });

  it("stops calling a listener after dispose()", () => {
    const emitter = new Emitter<string>();
    const listener = vi.fn();

    const disposable = emitter.event(listener);
    disposable.dispose();
    emitter.fire("ignored");

    expect(listener).not.toHaveBeenCalled();
  });

  it("disposing one listener does not affect others", () => {
    const emitter = new Emitter<number>();
    const a = vi.fn();
    const b = vi.fn();

    const disposableA = emitter.event(a);
    emitter.event(b);
    disposableA.dispose();
    emitter.fire(1);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(1);
  });

  it("disposing twice is a no-op", () => {
    const emitter = new Emitter<void>();
    const listener = vi.fn();

    const disposable = emitter.event(listener);
    disposable.dispose();
    disposable.dispose();
    emitter.fire();

    expect(listener).not.toHaveBeenCalled();
  });

  it("emitter.dispose() silences all listeners", () => {
    const emitter = new Emitter<string>();
    const listener = vi.fn();

    emitter.event(listener);
    emitter.dispose();
    emitter.fire("ignored");

    expect(listener).not.toHaveBeenCalled();
  });
});
