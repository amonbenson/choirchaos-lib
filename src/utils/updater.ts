import { Emitter } from "./events";

type UpdateProvider = "setTimeout" | "requestAnimationFrame";
export type UpdateProviderOption = UpdateProvider | "auto";

export type UpdateCallback = (delta: number) => void;
export type TimeProvider = () => number;

export type UpdaterOptions = {
  interval: number;
  maximumLag: number;
  timeProvider: TimeProvider;
};

export abstract class Updater {
  private readonly tickEmitter = new Emitter<number>();
  readonly onTick = this.tickEmitter.event;

  protected readonly options: UpdaterOptions;
  private lastUpdate: number = 0;
  private running: boolean = false;

  constructor(options: Partial<UpdaterOptions> = {}) {
    this.options = {
      interval: 1 / 50,
      maximumLag: 1.5,
      timeProvider: () => Date.now() / 1000,
      ...options,
    };
  }

  public getLastUpdate(): number {
    return this.lastUpdate;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public now(): number {
    return this.options.timeProvider();
  }

  protected _update(): void {
    // Calculate delta time
    const now = this.now();
    let delta = now - this.lastUpdate;
    this.lastUpdate = now;

    // Validate delta
    if (delta < 0) {
      console.error("Negative delta time! Make sure your timeProvider returns monotonic increasing values!");
      delta = 0;
    } else if (delta / this.options.interval > this.options.maximumLag) {
      console.warn(`Experiencing significant lag! (Update took ${(delta / this.options.interval).toFixed(2)}x longer than usual)`);
    }

    // Run update callback
    this.tickEmitter.fire(delta);

    // Call update complete handler
    this._updateCompleteImpl();
  }

  start(): void {
    if (this.running) {
      return;
    }

    // Reset time
    this.lastUpdate = this.options.timeProvider();

    this.running = true;
    this._startImpl();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this._stopImpl();
  }

  protected abstract _startImpl(): void;
  protected abstract _stopImpl(): void;
  protected abstract _updateCompleteImpl(): void;
}

export class SetIntervalUpdater extends Updater {
  private _intervalHandle?: ReturnType<typeof setInterval>;

  protected _startImpl(): void {
    // Setup a regular interval update handler
    this._intervalHandle = setInterval(() => this._update(), this.options.interval * 1000);
  }

  protected _stopImpl(): void {
    // Stop the interval
    clearInterval(this._intervalHandle);
  }

  protected _updateCompleteImpl(): void {}
}

export class AnimationFrameUpdater extends Updater {
  private _animationFrameHandle?: number;

  protected _startImpl(): void {
    // Request an animation frame to handle the update
    this._animationFrameHandle = requestAnimationFrame(() => this._update());
  }

  protected _stopImpl(): void {
    // Stop any ongoing animation frame
    cancelAnimationFrame(this._animationFrameHandle!);
  }

  protected _updateCompleteImpl(): void {
    // Request the next frame while we are still running
    if (this.isRunning()) {
      this._animationFrameHandle = requestAnimationFrame(() => this._update());
    }
  }
}
