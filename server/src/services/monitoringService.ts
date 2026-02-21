/**
 * System monitoring service.
 *
 * Provides access to:
 *   - ARC (Adaptive Replacement Cache) statistics from /proc/spl/kstat/zfs/arcstats
 *   - IO statistics via `zpool iostat`
 *   - Alert management (stored in SQLite)
 *   - System information (hostname, memory, CPU, ZFS version)
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type {
  ARCStats,
  Alert,
  AlertSeverity,
  AlertCategory,
  SystemInfo,
  IOStatEntry,
} from '@zfs-manager/shared';
import { getDb } from '../db/connection.js';
import { getExecutor } from './zfsExecutor.js';
import { parseZpoolIostat } from './zfsParser.js';
import { AppError } from '../middleware/errorHandler.js';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// ARC Statistics
// ---------------------------------------------------------------------------

/** Path to the ARC stats pseudo-file on Linux */
const ARC_STATS_PATH = '/proc/spl/kstat/zfs/arcstats';

/**
 * Read and parse ARC (Adaptive Replacement Cache) statistics.
 *
 * The arcstats file has lines like:
 *   name                            4    type    data
 *   hits                            4    123456789
 *   misses                          4    12345678
 */
export async function getArcStats(): Promise<ARCStats> {
  let content: string;

  try {
    content = await fs.readFile(ARC_STATS_PATH, 'utf-8');
  } catch {
    // Not on Linux or ZFS module not loaded -- return zeroed stats
    return {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      size: 0,
      maxSize: 0,
      mruSize: 0,
      mfuSize: 0,
    };
  }

  const stats = parseArcStatsFile(content);

  const hits = stats.get('hits') ?? 0;
  const misses = stats.get('misses') ?? 0;
  const total = hits + misses;

  return {
    hits,
    misses,
    hitRatio: total > 0 ? hits / total : 0,
    size: stats.get('size') ?? 0,
    maxSize: stats.get('c_max') ?? 0,
    mruSize: stats.get('mru_size') ?? stats.get('p') ?? 0,
    mfuSize: stats.get('mfu_size') ?? 0,
    l2Hits: stats.get('l2_hits'),
    l2Misses: stats.get('l2_misses'),
    l2Size: stats.get('l2_size'),
  };
}

/**
 * Parse the arcstats file into a map of stat name -> value.
 */
function parseArcStatsFile(content: string): Map<string, number> {
  const stats = new Map<string, number>();
  const lines = content.trim().split('\n');

  for (const line of lines) {
    // Skip header lines
    if (line.startsWith('name') || line.trim() === '') continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      const name = parts[0];
      const value = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(value)) {
        stats.set(name, value);
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// IOStat
// ---------------------------------------------------------------------------

/**
 * Get a one-shot iostat reading for all pools.
 */
export async function getIostat(): Promise<IOStatEntry[]> {
  const executor = getExecutor();
  const result = await executor.zpool('iostat', '-Hp');

  if (result.exitCode !== 0) {
    return [];
  }

  return parseZpoolIostat(result.stdout);
}

// ---------------------------------------------------------------------------
// Alert Management
// ---------------------------------------------------------------------------

/**
 * Get all alerts, optionally filtering by acknowledged status.
 */
export function getAlerts(acknowledged?: boolean): Alert[] {
  const db = getDb();

  let sql = 'SELECT * FROM alerts';
  const params: unknown[] = [];

  if (acknowledged !== undefined) {
    sql += ' WHERE acknowledged = ?';
    params.push(acknowledged ? 1 : 0);
  }

  sql += ' ORDER BY timestamp DESC';

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    severity: string;
    category: string;
    message: string;
    details: string | null;
    pool: string | null;
    device: string | null;
    timestamp: string;
    acknowledged: number;
    acknowledged_by: string | null;
    acknowledged_at: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    severity: row.severity as AlertSeverity,
    category: row.category as AlertCategory,
    message: row.message,
    details: row.details ?? undefined,
    pool: row.pool ?? undefined,
    device: row.device ?? undefined,
    timestamp: row.timestamp,
    acknowledged: row.acknowledged === 1,
    acknowledgedBy: row.acknowledged_by ?? undefined,
    acknowledgedAt: row.acknowledged_at ?? undefined,
  }));
}

/**
 * Acknowledge an alert.
 */
export function acknowledgeAlert(id: string, username: string): Alert {
  const db = getDb();

  const result = db.prepare(`
    UPDATE alerts
    SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = datetime('now')
    WHERE id = ?
  `).run(username, id);

  if (result.changes === 0) {
    throw new AppError(404, 'ALERT_NOT_FOUND', `Alert ${id} not found`);
  }

  // Fetch and return the updated alert
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as {
    id: string;
    severity: string;
    category: string;
    message: string;
    details: string | null;
    pool: string | null;
    device: string | null;
    timestamp: string;
    acknowledged: number;
    acknowledged_by: string | null;
    acknowledged_at: string | null;
  };

  return {
    id: row.id,
    severity: row.severity as AlertSeverity,
    category: row.category as AlertCategory,
    message: row.message,
    details: row.details ?? undefined,
    pool: row.pool ?? undefined,
    device: row.device ?? undefined,
    timestamp: row.timestamp,
    acknowledged: true,
    acknowledgedBy: row.acknowledged_by ?? undefined,
    acknowledgedAt: row.acknowledged_at ?? undefined,
  };
}

export interface CreateAlertParams {
  severity: AlertSeverity;
  category: AlertCategory;
  message: string;
  details?: string;
  pool?: string;
  device?: string;
}

/**
 * Create a new alert.
 */
export function createAlert(params: CreateAlertParams): Alert {
  const db = getDb();
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO alerts (id, severity, category, message, details, pool, device, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.severity, params.category, params.message, params.details ?? null, params.pool ?? null, params.device ?? null, timestamp);

  return {
    id,
    severity: params.severity,
    category: params.category,
    message: params.message,
    details: params.details,
    pool: params.pool,
    device: params.device,
    timestamp,
    acknowledged: false,
  };
}

// ---------------------------------------------------------------------------
// System Information
// ---------------------------------------------------------------------------

/**
 * Gather system information including ZFS version.
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  // Get ZFS version
  let zfsVersion = 'unknown';
  let zfsModuleVersion: string | undefined;

  try {
    const { stdout } = await execFile('zfs', ['version']);
    const lines = stdout.trim().split('\n');
    if (lines[0]) {
      zfsVersion = lines[0].replace('zfs-', '').trim();
    }
    if (lines[1]) {
      zfsModuleVersion = lines[1].replace('zfs-kmod-', '').trim();
    }
  } catch {
    // ZFS might not be installed
  }

  // Get hostname
  let hostname = os.hostname();
  try {
    const { stdout } = await execFile('hostname', ['-f']);
    hostname = stdout.trim() || hostname;
  } catch {
    // Use os.hostname() fallback
  }

  // Get kernel version
  let kernelVersion = os.release();
  try {
    const { stdout } = await execFile('uname', ['-r']);
    kernelVersion = stdout.trim();
  } catch {
    // Use os.release() fallback
  }

  const cpus = os.cpus();

  return {
    hostname,
    platform: os.platform(),
    arch: os.arch(),
    kernelVersion,
    uptime: os.uptime(),
    loadAverage: os.loadavg() as [number, number, number],
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model ?? 'Unknown',
    zfsVersion,
    zfsModuleVersion,
  };
}
