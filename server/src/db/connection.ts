/**
 * SQLite database connection singleton using better-sqlite3.
 *
 * - Creates the data directory if it does not exist.
 * - Enables WAL journal mode for better concurrent read performance.
 * - Provides a single shared Database instance for the entire server.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

/** The singleton database instance (lazily created) */
let db: Database.Database | null = null;

/**
 * Return the singleton better-sqlite3 Database instance.
 *
 * On first call the function will:
 *   1. Ensure the parent directory exists.
 *   2. Open (or create) the SQLite file.
 *   3. Enable WAL mode and foreign keys.
 *   4. Configure busy_timeout so concurrent writers queue briefly
 *      instead of throwing SQLITE_BUSY immediately.
 */
export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure the directory for the database file exists
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);

  // Performance and reliability pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  return db;
}

/**
 * Close the database connection gracefully.
 * Intended to be called during server shutdown.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
