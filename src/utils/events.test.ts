import { describe, expect, it, vi } from "vitest";

import { TypedEventEmitter } from "./events.js";

type TestEvents = {
  greet: [name: string];
  count: [value: number];
  done: [];
};

describe("TypedEventEmitter", () => {
  it("calls a registered listener with the correct arguments", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("greet", listener);
    emitter.emit("greet", "Alice");

    expect(listener).toHaveBeenCalledExactlyOnceWith("Alice");
  });

  it("calls multiple listeners for the same event", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();

    emitter.on("count", a).on("count", b);
    emitter.emit("count", 42);

    expect(a).toHaveBeenCalledWith(42);
    expect(b).toHaveBeenCalledWith(42);
  });

  it("does not call a listener after off()", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("greet", listener);
    emitter.off("greet", listener);
    emitter.emit("greet", "Bob");

    expect(listener).not.toHaveBeenCalled();
  });

  it("calls a once() listener exactly once", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.once("count", listener);
    emitter.emit("count", 1);
    emitter.emit("count", 2);

    expect(listener).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("returns true from emit() when listeners exist", () => {
    const emitter = new TypedEventEmitter<TestEvents>();

    emitter.on("done", vi.fn());

    expect(emitter.emit("done")).toBe(true);
  });

  it("returns false from emit() when no listeners exist", () => {
    const emitter = new TypedEventEmitter<TestEvents>();

    expect(emitter.emit("done")).toBe(false);
  });

  it("tracks listenerCount correctly", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();

    expect(emitter.listenerCount("greet")).toBe(0);

    emitter.on("greet", a).on("greet", b);
    expect(emitter.listenerCount("greet")).toBe(2);

    emitter.off("greet", a);
    expect(emitter.listenerCount("greet")).toBe(1);
  });

  it("removeAllListeners() removes listeners for a specific event", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("greet", listener).on("count", listener);
    emitter.removeAllListeners("greet");
    emitter.emit("greet", "Carol");
    emitter.emit("count", 7);

    expect(listener).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("removeAllListeners() with no argument removes all listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("greet", listener).on("count", listener).on("done", listener);
    emitter.removeAllListeners();
    emitter.emit("greet", "Dave");
    emitter.emit("count", 0);
    emitter.emit("done");

    expect(listener).not.toHaveBeenCalled();
  });
});
