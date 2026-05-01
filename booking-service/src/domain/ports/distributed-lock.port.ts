export type DistributedLockHandle = Readonly<{
  keys: readonly string[];
  token: string;
}>;

export interface DistributedLock {
  tryAcquire(
    keys: readonly string[],
    ttlMs: number,
  ): Promise<DistributedLockHandle | null>;

  release(handle: DistributedLockHandle): Promise<void>;
}

export const DISTRIBUTED_LOCK = Symbol('DISTRIBUTED_LOCK');
