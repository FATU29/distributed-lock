import { randomUUID } from 'node:crypto';

import type {
  DistributedLock,
  DistributedLockHandle,
} from '../../src/domain/ports/distributed-lock.port';

type Mode = 'grant' | 'deny' | 'throw';

/** Fixture error for tests that simulate Redlock release failing after a successful booking. */
export function redisReleasePartitionError(): Error {
  return new Error('redis partition');
}

/**
 * Programmable {@link DistributedLock} fake. Tracks acquire / release
 * calls so use-case specs can assert lock lifecycle without standing up
 * Redis.
 */
export class FakeDistributedLock implements DistributedLock {
  acquireCalls: { keys: string[]; ttlMs: number }[] = [];
  releaseCalls: DistributedLockHandle[] = [];
  private releaseError: Error | null = null;
  private mode: Mode = 'grant';
  private throwOn: Error | null = null;

  /**
   * Next `release` rejects with `error` (default: {@link redisReleasePartitionError}).
   * The booking use-case logs a warning on release failure; mute `Logger.prototype.warn`
   * in that test if you want clean Jest output.
   */
  failNextRelease(error: Error = redisReleasePartitionError()): void {
    this.releaseError = error;
  }

  clearReleaseFailure(): void {
    this.releaseError = null;
  }

  setMode(mode: Mode, error?: Error): void {
    this.mode = mode;
    this.throwOn = error ?? null;
  }

  tryAcquire(
    keys: readonly string[],
    ttlMs: number,
  ): Promise<DistributedLockHandle | null> {
    this.acquireCalls.push({ keys: [...keys], ttlMs });
    if (this.mode === 'deny') {
      return Promise.resolve(null);
    }
    if (this.mode === 'throw') {
      return Promise.reject(this.throwOn ?? new Error('lock backend down'));
    }
    return Promise.resolve(
      Object.freeze({ keys: [...keys], token: randomUUID() }),
    );
  }

  release(handle: DistributedLockHandle): Promise<void> {
    this.releaseCalls.push(handle);
    const err = this.releaseError;
    if (err) {
      this.releaseError = null;
      return Promise.reject(err);
    }
    return Promise.resolve();
  }
}
