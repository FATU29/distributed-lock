import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';

import { loadRedisInfrastructureConfig } from '../config/redis-config';
import { RedlockClient } from '../locking/redlock.client';
import { DISTRIBUTED_LOCK } from '../../domain/ports/distributed-lock.port';
import {
  CACHE_REDIS,
  REDIS_INFRASTRUCTURE_CONFIG,
  REDLOCK_LIB,
  REDLOCK_REDIS_CLIENTS,
} from './redis.tokens';

type RedlockCtor = {
  new (
    clients: Redis[],
    options?: {
      driftFactor?: number;
      retryCount?: number;
      retryDelay?: number;
      retryJitter?: number;
    },
  ): { quit(): Promise<unknown> };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Redlock = require('redlock') as RedlockCtor;

function cacheRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
  };
}

function redlockRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    commandTimeout: 50,
  };
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_INFRASTRUCTURE_CONFIG,
      useFactory: () => loadRedisInfrastructureConfig(),
    },
    {
      provide: CACHE_REDIS,
      useFactory: (cfg: ReturnType<typeof loadRedisInfrastructureConfig>) =>
        new Redis(cfg.cacheUrl, cacheRedisOptions()),
      inject: [REDIS_INFRASTRUCTURE_CONFIG],
    },
    {
      provide: REDLOCK_REDIS_CLIENTS,
      useFactory: (cfg: ReturnType<typeof loadRedisInfrastructureConfig>) =>
        cfg.redlockNodeUrls.map((url) => new Redis(url, redlockRedisOptions())),
      inject: [REDIS_INFRASTRUCTURE_CONFIG],
    },
    {
      provide: REDLOCK_LIB,
      useFactory: (clients: Redis[]) =>
        new Redlock(clients, {
          driftFactor: 0.01,
          retryCount: 10,
          retryDelay: 200,
          retryJitter: 200,
        }),
      inject: [REDLOCK_REDIS_CLIENTS],
    },
    RedlockClient,
    {
      provide: DISTRIBUTED_LOCK,
      useExisting: RedlockClient,
    },
  ],
  exports: [CACHE_REDIS, DISTRIBUTED_LOCK],
})
export class RedisInfrastructureModule implements OnModuleDestroy {
  constructor(
    @Inject(CACHE_REDIS) private readonly cacheRedis: Redis,
    @Inject(REDLOCK_LIB) private readonly redlock: { quit(): Promise<unknown> },
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.redlock.quit().catch(() => undefined),
      this.cacheRedis.quit().catch(() => undefined),
    ]);
  }
}
