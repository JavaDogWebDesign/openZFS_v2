/**
 * ZFS replication service.
 *
 * Provides snapshot send/receive operations for local and (eventually)
 * remote replication. Uses `zfs send` and `zfs receive` via execFile.
 *
 * This is a foundational stub -- full remote replication (over SSH) will
 * be built on top of these primitives in a future iteration.
 */

import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { AppError } from '../middleware/errorHandler.js';

const execFile = promisify(execFileCb);

const ZFS_BIN = '/usr/sbin/zfs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendOptions {
  /** The snapshot to send (e.g. "pool/dataset@snap1") */
  snapshot: string;
  /** Optional base snapshot for incremental send (e.g. "pool/dataset@snap0") */
  incremental?: string;
  /** Use raw send (preserves encryption) */
  raw?: boolean;
  /** Include intermediate snapshots (for -I incremental) */
  intermediary?: boolean;
  /** Estimate size only (do not actually send) */
  dryRun?: boolean;
}

export interface ReceiveOptions {
  /** Target dataset to receive into */
  target: string;
  /** Force receive (destroy existing data) */
  force?: boolean;
  /** Discard the received dataset's mountpoint */
  unmounted?: boolean;
}

export interface SendEstimate {
  /** Estimated size in bytes */
  sizeBytes: number;
  /** Human-readable size string */
  sizeHuman: string;
}

export interface ReplicationProgress {
  /** Bytes sent so far */
  bytesSent: number;
  /** Total estimated bytes (if known) */
  bytesTotal?: number;
  /** Percentage complete (0-100) */
  percentage?: number;
  /** Whether the operation is complete */
  done: boolean;
  /** Error message if the operation failed */
  error?: string;
}

// ---------------------------------------------------------------------------
// Send operations
// ---------------------------------------------------------------------------

/**
 * Send a snapshot to a local target dataset (pipe `zfs send | zfs receive`).
 *
 * @returns A promise that resolves when the send/receive is complete.
 */
export async function sendSnapshot(
  sendOpts: SendOptions,
  receiveOpts: ReceiveOptions,
  onProgress?: (progress: ReplicationProgress) => void,
): Promise<void> {
  const sendArgs = buildSendArgs(sendOpts);
  const recvArgs = buildReceiveArgs(receiveOpts);

  return new Promise<void>((resolve, reject) => {
    // Spawn the send process
    const sendProc = spawn(ZFS_BIN, sendArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Spawn the receive process, piping send's stdout to recv's stdin
    const recvProc = spawn(ZFS_BIN, recvArgs, {
      stdio: [sendProc.stdout, 'pipe', 'pipe'],
    });

    let sendStderr = '';
    let recvStderr = '';

    sendProc.stderr.on('data', (data: Buffer) => {
      sendStderr += data.toString();
    });

    recvProc.stderr.on('data', (data: Buffer) => {
      recvStderr += data.toString();
    });

    // Track progress if callback provided
    let bytesSent = 0;
    sendProc.stdout?.on('data', (data: Buffer) => {
      bytesSent += data.length;
      onProgress?.({
        bytesSent,
        done: false,
      });
    });

    recvProc.on('close', (code) => {
      if (code === 0) {
        onProgress?.({ bytesSent, done: true });
        resolve();
      } else {
        const msg = recvStderr || sendStderr || `zfs receive exited with code ${code}`;
        onProgress?.({ bytesSent, done: true, error: msg });
        reject(new AppError(500, 'REPLICATION_FAILED', `Receive failed: ${msg}`));
      }
    });

    sendProc.on('error', (err) => {
      reject(new AppError(500, 'REPLICATION_FAILED', `Send process error: ${err.message}`));
    });

    recvProc.on('error', (err) => {
      reject(new AppError(500, 'REPLICATION_FAILED', `Receive process error: ${err.message}`));
    });
  });
}

/**
 * Receive a snapshot stream from stdin.
 * This variant is intended for use with piped data (e.g. from a remote source).
 */
export async function receiveSnapshot(
  target: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const args = ['receive'];
  if (options.force) args.push('-F');
  args.push(target);

  // This is a stub -- actual implementation would read from a provided stream
  try {
    await execFile(ZFS_BIN, args);
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(500, 'RECEIVE_FAILED', `zfs receive failed: ${error.stderr ?? 'unknown error'}`);
  }
}

// ---------------------------------------------------------------------------
// Size estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the size of a `zfs send` stream without actually sending data.
 */
export async function estimateSendSize(
  snapshot: string,
  incremental?: string,
): Promise<SendEstimate> {
  const args = ['send', '-n', '-v'];

  if (incremental) {
    args.push('-i', incremental);
  }

  args.push(snapshot);

  try {
    const { stderr } = await execFile(ZFS_BIN, args);

    // `zfs send -nv` outputs the estimate to stderr, e.g.:
    //   "size estimate is 1.23G"
    const sizeMatch = stderr.match(/size\s+(?:estimate\s+is\s+)?([\d.]+)([KMGT]?)/i);

    if (sizeMatch) {
      const num = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      const multipliers: Record<string, number> = {
        '': 1,
        'K': 1024,
        'M': 1024 ** 2,
        'G': 1024 ** 3,
        'T': 1024 ** 4,
      };
      const sizeBytes = Math.round(num * (multipliers[unit] ?? 1));

      return {
        sizeBytes,
        sizeHuman: `${num}${unit}`,
      };
    }

    // Fallback: try to parse a raw byte count
    const byteMatch = stderr.match(/total estimated size is (\d+)/);
    if (byteMatch) {
      const sizeBytes = parseInt(byteMatch[1], 10);
      return {
        sizeBytes,
        sizeHuman: formatBytes(sizeBytes),
      };
    }

    return { sizeBytes: 0, sizeHuman: '0' };
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(400, 'ESTIMATE_FAILED', `Failed to estimate send size: ${error.stderr ?? 'unknown error'}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSendArgs(opts: SendOptions): string[] {
  const args = ['send'];

  if (opts.raw) args.push('-w');

  if (opts.incremental) {
    if (opts.intermediary) {
      args.push('-I', opts.incremental);
    } else {
      args.push('-i', opts.incremental);
    }
  }

  if (opts.dryRun) {
    args.push('-n', '-v');
  }

  args.push(opts.snapshot);
  return args;
}

function buildReceiveArgs(opts: ReceiveOptions): string[] {
  const args = ['receive'];

  if (opts.force) args.push('-F');
  if (opts.unmounted) args.push('-u');

  args.push(opts.target);
  return args;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'K', 'M', 'G', 'T'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(2)}${units[i]}`;
}
