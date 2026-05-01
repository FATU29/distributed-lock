export type RedisInfrastructureConfig = {
  cacheUrl: string;
  redlockNodeUrls: readonly string[];
};

function isRedisUrl(value: string): boolean {
  return value.startsWith('redis://') || value.startsWith('rediss://');
}

export function loadRedisInfrastructureConfig(
  env: NodeJS.ProcessEnv = process.env,
): RedisInfrastructureConfig {
  const cacheUrl = env.REDIS_CACHE_URL?.trim() ?? '';
  if (!cacheUrl || !isRedisUrl(cacheUrl)) {
    throw new Error(
      'REDIS_CACHE_URL is required (redis:// or rediss://) — cache-aside availability reads; must not be used for Redlock',
    );
  }

  const raw = env.REDLOCK_NODES?.trim() ?? '';
  if (!raw) {
    throw new Error(
      'REDLOCK_NODES is required — comma-separated redis:// URLs for independent Redis masters (5 nodes for 3-of-5 quorum; see docs/scenario/content.md §4)',
    );
  }

  const redlockNodeUrls = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (redlockNodeUrls.length !== 5) {
    throw new Error(
      'REDLOCK_NODES must list exactly 5 redis:// URLs — one client per independent master for Redlock quorum',
    );
  }

  for (const url of redlockNodeUrls) {
    if (!isRedisUrl(url)) {
      throw new Error(
        `REDLOCK_NODES entry must be redis:// or rediss:// — got: ${url}`,
      );
    }
  }

  return { cacheUrl, redlockNodeUrls };
}
