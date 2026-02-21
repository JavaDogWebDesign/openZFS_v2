/**
 * Initial migration - creates all core tables from schema.sql.
 */

import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Migration } from './runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Read the schema SQL file at build/run time */
function readSchemaSQL(): string {
  const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
  return fs.readFileSync(schemaPath, 'utf-8');
}

const migration: Migration = {
  id: '001_initial',

  up(db: Database.Database): void {
    const sql = readSchemaSQL();
    db.exec(sql);
  },
};

export default migration;
