/**
 * ZFS scrub management service.
 *
 * Provides operations for starting, pausing, cancelling scrubs,
 * querying scrub status, and managing scrub schedules stored in SQLite.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ScrubStatus, ScrubSchedule, ScrubHistoryEntry } from '@zfs-manager/shared';
import { getExecutor } from './zfsExecutor.js';
import { getDb } from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Scrub operations
// ---------------------------------------------------------------------------

/**
 * Start a scrub on the specified pool.
 */
export async function startScrub(pool: string): Promise<void> {
  const executor = getExecutor();
  const result = await executor.zpool('scrub', pool);

  if (result.exitCode !== 0) {
    throw new AppError(400, 'SCRUB_START_FAILED', `Failed to start scrub: ${result.stderr}`);
  }

  // Record in history
  const db = getDb();
  db.prepare(`
    INSERT INTO scrub_history (pool, start_time)
    VALUES (?, datetime('now'))
  `).run(pool);
}

/**
 * Pause a running scrub on the specified pool.
 */
export async function pauseScrub(pool: string): Promise<void> {
  const executor = getExecutor();
  const result = await executor.zpool('scrub', '-p', pool);

  if (result.exitCode !== 0) {
    throw new AppError(400, 'SCRUB_PAUSE_FAILED', `Failed to pause scrub: ${result.stderr}`);
  }
}

/**
 * Cancel a running or paused scrub on the specified pool.
 */
export async function cancelScrub(pool: string): Promise<void> {
  const executor = getExecutor();
  const result = await executor.zpool('scrub', '-s', pool);

  if (result.exitCode !== 0) {
    throw new AppError(400, 'SCRUB_CANCEL_FAILED', `Failed to cancel scrub: ${result.stderr}`);
  }
}

/**
 * Get the current scrub status for a pool by parsing `zpool status`.
 */
export async function getScrubStatus(pool: string): Promise<ScrubStatus> {
  const executor = getExecutor();
  const result = await executor.zpool('status', pool);

  if (result.exitCode !== 0) {
    throw new AppError(400, 'SCRUB_STATUS_FAILED', `Failed to get scrub status: ${result.stderr}`);
  }

  return parseScrubStatus(pool, result.stdout);
}

/**
 * Parse scrub status from `zpool status` output.
 */
function parseScrubStatus(pool: string, stdout: string): ScrubStatus {
  const status: ScrubStatus = {
    pool,
    state: 'none',
  };

  const scanLine = stdout.split('\n').find((line) => line.trim().startsWith('scan:'));

  if (!scanLine) {
    return status;
  }

  const text = scanLine.replace(/^\s*scan:\s*/, '');

  // Detect state
  if (text.includes('scrub in progress')) {
    status.state = 'running';
  } else if (text.includes('scrub repaired') || text.includes('scrub completed')) {
    status.state = 'finished';
  } else if (text.includes('scrub canceled')) {
    status.state = 'canceled';
  }

  // Check for paused state
  if (text.includes('paused')) {
    status.paused = true;
  }

  // Extract percentage
  const pctMatch = text.match(/([\d.]+)%\s*done/);
  if (pctMatch) {
    status.percentage = parseFloat(pctMatch[1]);
  }

  // Extract scanned/issued amounts (in human-readable format)
  const scannedMatch = text.match(/([\d.]+[KMGT]?)\s*scanned/i);
  if (scannedMatch) {
    status.scanned = parseHumanSize(scannedMatch[1]);
  }

  const issuedMatch = text.match(/([\d.]+[KMGT]?)\s*issued/i);
  if (issuedMatch) {
    status.issued = parseHumanSize(issuedMatch[1]);
  }

  // Extract errors
  const errorsMatch = text.match(/(\d+)\s*errors?/i);
  if (errorsMatch) {
    status.errors = parseInt(errorsMatch[1], 10);
  }

  // Extract time remaining
  const timeMatch = text.match(/(\d+h\d+m|\d+:\d+:\d+)\s*to go/);
  if (timeMatch) {
    status.timeRemaining = timeMatch[1];
  }

  return status;
}

// ---------------------------------------------------------------------------
// Schedule management
// ---------------------------------------------------------------------------

/**
 * Get all scrub schedules.
 */
export function getSchedules(): ScrubSchedule[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM scrub_schedules ORDER BY pool').all() as Array<{
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
 * Create or update a scrub schedule for a pool.
 */
export function setSchedule(pool: string, cronExpression: string, enabled = true): ScrubSchedule {
  const db = getDb();

  // Check if a schedule already exists for this pool
  const existing = db.prepare('SELECT id FROM scrub_schedules WHERE pool = ?').get(pool) as
    | { id: string }
    | undefined;

  if (existing) {
    db.prepare(`
      UPDATE scrub_schedules SET cron_expression = ?, enabled = ? WHERE pool = ?
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
    INSERT INTO scrub_schedules (id, pool, cron_expression, enabled)
    VALUES (?, ?, ?, ?)
  `).run(id, pool, cronExpression, enabled ? 1 : 0);

  return { id, pool, cronExpression, enabled };
}

/**
 * Delete a scrub schedule.
 */
export function deleteSchedule(id: string): void {
  const db = getDb();
  const result = db.prepare('DELETE FROM scrub_schedules WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', `Scrub schedule ${id} not found`);
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * Get scrub history, optionally filtered by pool.
 */
export function getScrubHistory(pool?: string, limit = 50): ScrubHistoryEntry[] {
  const db = getDb();

  let sql = 'SELECT * FROM scrub_history';
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
    bytes_scanned: number;
    bytes_issued: number;
    errors: number;
    duration: number;
  }>;

  return rows.map((row) => ({
    pool: row.pool,
    startTime: row.start_time,
    endTime: row.end_time ?? '',
    bytesScanned: row.bytes_scanned,
    bytesIssued: row.bytes_issued,
    errors: row.errors,
    duration: row.duration,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a human-readable size string (e.g. "1.5G") to bytes.
 */
function parseHumanSize(str: string): number {
  const match = str.match(/^([\d.]+)([KMGT]?)$/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    '': 1,
    'K': 1024,
    'M': 1024 ** 2,
    'G': 1024 ** 3,
    'T': 1024 ** 4,
  };

  return Math.round(num * (multipliers[unit] ?? 1));
}
