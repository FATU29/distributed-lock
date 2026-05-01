export type DatabaseConfig = {
  databaseUrl: string;
};

function isSupportedPostgresDatasource(value: string): boolean {
  return (
    value.startsWith('postgres://') ||
    value.startsWith('postgresql://') ||
    value.startsWith('prisma://')
  );
}

export function loadDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const databaseUrl = env.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!isSupportedPostgresDatasource(databaseUrl)) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL or Prisma Data Platform URL',
    );
  }
  return { databaseUrl };
}
