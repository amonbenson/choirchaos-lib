export interface Disposable {
  dispose(): void;
}

export type Event<T> = (listener: (value: T) => void) => Disposable;

export type Emitters = Record<string, Emitter<any>>;

export class Emitter<T> {
  private _listeners = new Set<(value: T) => void>();

  readonly event: Event<T> = (listener) => {
    this._listeners.add(listener);

    return {
      dispose: () => {
        this._listeners.delete(listener);
      },
    };
  };

  fire(value: T): void {
    for (const listener of this._listeners) {
      listener(value);
    }
  }

  dispose(): void {
    this._listeners.clear();
  }
}
