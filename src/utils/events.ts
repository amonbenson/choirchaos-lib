type EventMap = Record<string, unknown[]>;

type Listener<TArgs extends unknown[]> = (...args: TArgs) => void;

export class TypedEventEmitter<TEvents extends EventMap> {
  private listeners = new Map<keyof TEvents, Set<Listener<unknown[]>>>();

  on<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: Listener<TEvents[TEvent]>,
  ): this {
    let set = this.listeners.get(event);

    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }

    set.add(listener as Listener<unknown[]>);

    return this;
  }

  off<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: Listener<TEvents[TEvent]>,
  ): this {
    this.listeners.get(event)?.delete(listener as Listener<unknown[]>);

    return this;
  }

  once<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: Listener<TEvents[TEvent]>,
  ): this {
    const wrapper: Listener<TEvents[TEvent]> = (...args) => {
      this.off(event, wrapper);
      listener(...args);
    };

    return this.on(event, wrapper);
  }

  emit<TEvent extends keyof TEvents>(
    event: TEvent,
    ...args: TEvents[TEvent]
  ): boolean {
    const set = this.listeners.get(event);

    if (!set || set.size === 0) {
      return false;
    }

    for (const listener of set) {
      listener(...args);
    }

    return true;
  }

  listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(event?: keyof TEvents): this {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }

    return this;
  }
}
