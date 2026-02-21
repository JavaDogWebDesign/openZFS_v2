/**
 * ZFS TRIM management service.
 *
 * Provides operations for starting, cancelling TRIM operations,
 * querying TRIM status, and managing TRIM schedules stored in SQLite.
 */

import { v4 as uuidv4 } from 'uuid';
import type { TrimStatus, TrimSchedule, TrimHistoryEntry } from '@zfs-manager/shared';
import { getExecutor } from './zfsExecutor.js';
import { getDb } from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// TRIM operations
// ---------------------------------------------------------------------------

/**
 * Start a TRIM operation on the specified pool.
 */
export async function startTrim(pool: string): Promise<void> {
  const executor = getExecutor();
  const result = await executor.zpool('trim', pool);

  if (result.exitCode !== 0) {
    throw new AppError(400, 'TRIM_START_FAILED', `Failed to start TRIM: ${result.stderr}`);
  }

  // Record in history
  const db = getDb();
  db.prepare(`
    INSERT INTO trim_history (pool, start_time, state)
    VALUES (?, datetime('now'), 'running')
  `).run(pool);
}

/**
 * Cancel a running TRIM on the specified pool.
 */
export async function cancelTrim(pool: string): Promise<void> {
  const executor = getExecutor();
  const result = await executor.zpool('trim', '-s', pool);

  if (result.exitCode !== 0) {
    throw new AppError(400, 'TRIM_CANCEL_FAILED', `Failed to cancel TRIM: ${result.stderr}`);
  }
}

/**
 * Get the current TRIM status for a pool by parsing `zpool status`.
 */
export async function getTrimStatus(pool: string): Promise<TrimStatus> {
  const executor = getExecutor();
  const result = await executor.zpool('status', '-t', pool);

  if (result.exitCode !== 0) {
    throw new AppError(400, 'TRIM_STATUS_FAILED', `Failed to get TRIM status: ${result.stderr}`);
  }

  return parseTrimStatus(pool, result.stdout);
}

/**
 * Parse TRIM status from `zpool status -t` output.
 */
function parseTrimStatus(pool: string, stdout: string): TrimStatus {
  const status: TrimStatus = {
    pool,
    state: 'none',
  };

  // Look for trim-related lines in the output
  const lines = stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('trimmed,')) {
      // e.g. "1.23G trimmed, 45.6% done"
      status.state = 'running';

      const pctMatch = trimmed.match(/([\d.]+)%/);
      if (pctMatch) {
        status.percentage = parseFloat(pctMatch[1]);
      }

      if (trimmed.includes('100%') || trimmed.includes('completed')) {
        status.state = 'finished';
      }
    }

    if (trimmed.includes('trim suspended') || trimmed.includes('trim: suspended')) {
      status.state = 'suspended';
    }

    if (trimmed.includes('trim completed')) {
      status.state = 'finished';
    }
  }

  return status;
}

// ---------------------------------------------------------------------------
// Schedule management
// ---------------------------------------------------------------------------

/**
 * Get all TRIM schedules.
 */
export function getSchedules(): TrimSchedule[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM trim_schedules ORDER BY pool').all() as Array<{
    id: string;
    pool: string;
    cron_expression: string;
    enabled: number;
    last_run: string | null;
    next_run: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    pool: row.pool,
    cronExpression: row.cron_expression,
    enabled: row.enabled === 1,
    lastRun: row.last_run ?? undefined,
    nextRun: row.next_run ?? undefined,
  }));
}

/**
 * Create or update a TRIM schedule for a pool.
 */
export function setSchedule(pool: string, cronExpression: string, enabled = true): TrimSchedule {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM trim_schedules WHERE pool = ?').get(pool) as
    | { id: string }
    | undefined;

  if (existing) {
    db.prepare(`
      UPDATE trim_schedules SET cron_expression = ?, enabled = ? WHERE pool = ?
    `).run(cronExpression, enabled ? 1 : 0, pool);

    return {
      id: existing.id,
      pool,
      cronExpression,
      enabled,
    };
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO trim_schedules (id, pool, cron_expression, enabled)
    VALUES (?, ?, ?, ?)
  `).run(id, pool, cronExpression, enabled ? 1 : 0);

  return { id, pool, cronExpression, enabled };
}

/**
 * Delete a TRIM schedule.
 */
export function deleteSchedule(id: string): void {
  const db = getDb();
  const result = db.prepare('DELETE FROM trim_schedules WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', `TRIM schedule ${id} not found`);
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * Get TRIM history, optionally filtered by pool.
 */
export function getTrimHistory(pool?: string, limit = 50): TrimHistoryEntry[] {
  const db = getDb();

  let sql = 'SELECT * FROM trim_history';
  const params: unknown[] = [];

  if (pool) {
    sql += ' WHERE pool = ?';
    params.push(pool);
  }

  sql += ' ORDER BY start_time DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Array<{
    pool: string;
    start_time: string;
    end_time: string | null;
    state: string;
  }>;

  return rows.map((row) => ({
    pool: row.pool,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    state: row.state,
  }));
}
