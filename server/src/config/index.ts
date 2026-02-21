/**
 * Server configuration - reads from environment variables with sensible defaults.
 * All configuration is centralized here to make it easy to audit and modify.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolved configuration object for the server */
export interface ServerConfig {
  /** HTTP port to listen on */
  port: number;
  /** Path to the SQLite database file */
  dbPath: string;
  /** Secret used for session token signing / CSRF */
  sessionSecret: string;
  /** Allowed CORS origin(s) for the client */
  corsOrigin: string;
  /** Current runtime environment */
  nodeEnv: 'development' | 'production' | 'test';
  /** Minimum log level for winston */
  logLevel: string;
  /** Session TTL in seconds (default 8 hours) */
  sessionTtlSeconds: number;
  /** Whether to trust the X-Forwarded-For header (behind reverse proxy) */
  trustProxy: boolean;
}

/**
 * Build the config object from process.env.
 * Called once at startup; the result is exported as a frozen singleton.
 */
function loadConfig(): ServerConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as ServerConfig['nodeEnv'];

  // Default DB path is <project-root>/data/zfs-manager.db
  const defaultDbPath = path.resolve(__dirname, '..', '..', '..', 'data', 'zfs-manager.db');

  return Object.freeze({
    port: parseInt(process.env.PORT ?? '3001', 10),
    dbPath: process.env.DB_PATH ?? defaultDbPath,
    sessionSecret: process.env.SESSION_SECRET ?? 'change-me-in-production',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    nodeEnv,
    logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug'),
    sessionTtlSeconds: parseInt(process.env.SESSION_TTL ?? '28800', 10),
    trustProxy: process.env.TRUST_PROXY === 'true',
  });
}

/** Singleton server configuration */
export const config = loadConfig();
