import pg from 'pg';

const { Pool } = pg;
type PgPool = pg.Pool;
type PoolClient = pg.PoolClient;

import { logger } from '../utils/logger.js';

let appPool: PgPool | undefined;

export function getAppDatabaseUrl(): string {
  const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('APP_DATABASE_URL or DATABASE_URL must be provided for entity storage.');
  }
  return url;
}

export function getAppPool(): PgPool {
  if (!appPool) {
    const connectionString = getAppDatabaseUrl();
    appPool = new Pool({ connectionString });
    appPool.on('error', (error: Error) => {
      logger.error('Unexpected database error', error);
    });
  }
  return appPool;
}

export async function withAppClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getAppPool();
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function closeAppPool() {
  if (appPool) {
    await appPool.end();
    appPool = undefined;
  }
}
