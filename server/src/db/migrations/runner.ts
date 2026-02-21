/**
 * Simple migration runner for SQLite.
 *
 * - Maintains a `migrations` table that records which migrations have been applied.
 * - Each migration is a module exporting { id: string; up(db): void }.
 * - Migrations are run inside a transaction for atomicity.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

/** Shape every migration module must satisfy */
export interface Migration {
  /** Unique identifier, e.g. "001_initial" */
  id: string;
  /** Apply the migration (receives the database instance) */
  up(db: Database.Database): void;
}

/**
 * Ensure the bookkeeping table exists.
 */
function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Return the set of migration IDs that have already been applied.
 */
function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT id FROM migrations ORDER BY id').all() as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

/**
 * Run all pending migrations in the order they appear in the supplied array.
 *
 * @param migrations - Ordered list of migration objects to consider.
 */
export function runMigrations(migrations: Migration[]): void {
  const db = getDb();

  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    // Run each migration inside its own transaction
    const applyMigration = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO migrations (id) VALUES (?)').run(migration.id);
    });

    applyMigration();
    console.log(`[migrations] Applied: ${migration.id}`);
  }
}
