import { SetIntervalUpdater, type Updater } from "@/utils/updater";

import type Transport from "./transport";

/**
 * Drives a Transport by calling step() on a regular interval.
 *
 * The clock runs continuously while alive. It calls transport.step() on
 * each tick only when the transport is playing, so the transport itself
 * does not need to manage any timers.
 */
export abstract class Clock {
  abstract setup(transport: Transport): void;

  abstract dispose(): void;
}

export class SetIntervalClock extends Clock {
  private readonly updater: Updater;

  constructor(updater?: Updater) {
    super();

    this.updater = updater ?? new SetIntervalUpdater({
      interval: 1 / 50,
      maximumLag: 5.0,
    });
  }

  setup(transport: Transport): void {
    this.updater.onTick((delta) => {
      if (transport.isPlaying()) {
        transport.step(delta);
      }
    });

    this.updater.start();
  }

  dispose(): void {
    this.updater.stop();
  }
}
