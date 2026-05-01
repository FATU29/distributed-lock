import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import type {
  DistributedLock,
  DistributedLockHandle,
} from '../../domain/ports/distributed-lock.port';
import { REDLOCK_LIB } from '../redis/redis.tokens';

type RedlockLock = {
  value: string;
  unlock(): Promise<void>;
};

type RedlockInstance = {
  lockWithOptions(
    resource: string | string[],
    ttl: number,
    options: { retryCount: number },
  ): Promise<RedlockLock>;
};

type RedlockConstructor = {
  new (
    clients: Redis[],
    options?: {
      driftFactor?: number;
      retryCount?: number;
      retryDelay?: number;
      retryJitter?: number;
    },
  ): RedlockInstance;
  LockError: new (message?: string) => Error;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- redlock is CommonJS without bundled types
const Redlock = require('redlock') as RedlockConstructor;

@Injectable()
export class RedlockClient implements DistributedLock {
  private readonly acquired = new Map<string, RedlockLock>();

  constructor(@Inject(REDLOCK_LIB) private readonly redlock: RedlockInstance) {}

  async tryAcquire(
    keys: readonly string[],
    ttlMs: number,
  ): Promise<DistributedLockHandle | null> {
    if (keys.length === 0) {
      throw new Error('DistributedLock.tryAcquire requires at least one key');
    }

    const resource = keys.length === 1 ? keys[0] : [...keys];

    try {
      const lock = await this.redlock.lockWithOptions(resource, ttlMs, {
        retryCount: 0,
      });
      const handle: DistributedLockHandle = Object.freeze({
        keys: [...keys],
        token: lock.value,
      });
      this.acquired.set(lock.value, lock);
      return handle;
    } catch (err) {
      if (err instanceof Redlock.LockError) {
        return null;
      }
      throw err;
    }
  }

  async release(handle: DistributedLockHandle): Promise<void> {
    const lock = this.acquired.get(handle.token);
    if (!lock) {
      return;
    }
    this.acquired.delete(handle.token);
    try {
      await lock.unlock();
    } catch {
      // Lock TTL will expire; unlock failures are expected under partitions.
    }
  }
}
