/**
 * Database Connection Service for PostgreSQL
 * -----------------------------------------
 * - Uses connection pooling for performance
 * - Loads configuration from environment variables (see below)
 * - Provides health checks, retry logic, and graceful shutdown
 * - Exposes pool and utility methods for use in repositories/services
 * - Designed for integration with test framework (exported close method)
 *
 * Required Environment Variables:
 *   - PGHOST
 *   - PGPORT
 *   - PGUSER
 *   - PGPASSWORD
 *   - PGDATABASE
 *   - PGPOOL_MIN (optional, default: 1)
 *   - PGPOOL_MAX (optional, default: 10)
 *   - PG_CONNECTION_TIMEOUT_MS (optional, default: 5000)
 *   - PG_IDLE_TIMEOUT_MS (optional, default: 10000)
 */

import { Pool, PoolConfig, PoolClient } from 'pg';

const {
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  PGPOOL_MIN,
  PGPOOL_MAX,
  PG_CONNECTION_TIMEOUT_MS,
  PG_IDLE_TIMEOUT_MS,
  NODE_ENV,
} = process.env;

if (!PGHOST || !PGPORT || !PGUSER || !PGPASSWORD || !PGDATABASE) {
  throw new Error(
    'Missing required PostgreSQL environment variables. Please check .env.example for required configuration.'
  );
}

const poolConfig: PoolConfig = {
  host: PGHOST,
  port: parseInt(PGPORT, 10),
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  min: PGPOOL_MIN ? parseInt(PGPOOL_MIN, 10) : 1,
  max: PGPOOL_MAX ? parseInt(PGPOOL_MAX, 10) : 10,
  connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS
    ? parseInt(PG_CONNECTION_TIMEOUT_MS, 10)
    : 5000,
  idleTimeoutMillis: PG_IDLE_TIMEOUT_MS
    ? parseInt(PG_IDLE_TIMEOUT_MS, 10)
    : 10000,
  allowExitOnIdle: NODE_ENV === 'test', // allow pool to exit in test mode
};

const pool = new Pool(poolConfig);

/**
 * Attempts to acquire a client from the pool with retry logic.
 * @param retries Number of retry attempts
 * @param delayMs Delay between retries in ms
 */
export async function getClientWithRetry(
  retries = 3,
  delayMs = 1000
): Promise<PoolClient> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  throw new Error(
    `Failed to acquire database client after ${retries} attempts: ${String(
      lastError
    )}`
  );
}

/**
 * Checks the health of the database connection.
 * Returns true if the connection is healthy, false otherwise.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Gracefully shuts down the database pool.
 * Should be called on process exit or in test teardown.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

/**
 * Registers graceful shutdown handlers for SIGINT and SIGTERM.
 * Should be called once during app startup.
 */
export function registerShutdown(): void {
  const shutdown = async () => {
    try {
      await closePool();
      // eslint-disable-next-line no-console
      console.log('Database pool closed gracefully.');
      process.exit(0);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error during database pool shutdown:', err);
      process.exit(1);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Export the pool for query usage in repositories/services
export { pool };

/**
 * Example usage:
 * import { pool, getClientWithRetry, checkDbHealth, closePool, registerShutdown } from './connection';
 */