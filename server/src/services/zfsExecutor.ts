/**
 * Core ZFS command executor.
 *
 * All ZFS / ZPOOL commands are funnelled through this singleton so that:
 *   1. We always use `execFile` (never `exec`) to avoid shell injection.
 *   2. Destructive operations go through a global mutex (serialised queue)
 *      so that concurrent API requests cannot clobber each other.
 *   3. We transparently try the JSON output flag (`-j`) first and fall back
 *      to plain-text parsing when the installed ZFS version lacks it.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Mutex for destructive operations
// ---------------------------------------------------------------------------

type MutexRelease = () => void;

class Mutex {
  private queue: Array<(release: MutexRelease) => void> = [];
  private locked = false;

  acquire(): Promise<MutexRelease> {
    return new Promise<MutexRelease>((resolve) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => {
            this.locked = false;
            const next = this.queue.shift();
            if (next) {
              next(tryAcquire as unknown as MutexRelease);
              tryAcquire();
            }
          });
        } else {
          this.queue.push(() => {
            tryAcquire();
          });
        }
      };
      tryAcquire();
    });
  }
}

// ---------------------------------------------------------------------------
// Command result types
// ---------------------------------------------------------------------------

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface JsonCommandResult<T = unknown> {
  data: T;
  usedJson: boolean;
}

// ---------------------------------------------------------------------------
// ZfsExecutor singleton
// ---------------------------------------------------------------------------

const ZFS_BIN = '/usr/sbin/zfs';
const ZPOOL_BIN = '/usr/sbin/zpool';

/** Default command timeout: 60 seconds */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Longer timeout for potentially slow operations (send/receive, scrub) */
const LONG_TIMEOUT_MS = 600_000;

export class ZfsExecutor {
  private static instance: ZfsExecutor | null = null;
  private readonly destructiveMutex = new Mutex();

  private constructor() {
    // singleton
  }

  static getInstance(): ZfsExecutor {
    if (!ZfsExecutor.instance) {
      ZfsExecutor.instance = new ZfsExecutor();
    }
    return ZfsExecutor.instance;
  }

  // -------------------------------------------------------------------------
  // Low-level runners
  // -------------------------------------------------------------------------

  /**
   * Execute an arbitrary command via execFile.
   * Never uses a shell; arguments are passed directly to the binary.
   */
  private async run(
    bin: string,
    args: string[],
    options: { timeout?: number; destructive?: boolean } = {},
  ): Promise<CommandResult> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

    const execute = async (): Promise<CommandResult> => {
      try {
        const { stdout, stderr } = await execFile(bin, args, {
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10 MB
        });
        return { stdout, stderr, exitCode: 0 };
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
        return {
          stdout: error.stdout ?? '',
          stderr: error.stderr ?? error.message ?? 'Unknown error',
          exitCode: typeof error.code === 'number' ? error.code : 1,
        };
      }
    };

    if (options.destructive) {
      const release = await this.destructiveMutex.acquire();
      try {
        return await execute();
      } finally {
        release();
      }
    }

    return execute();
  }

  // -------------------------------------------------------------------------
  // Public command helpers
  // -------------------------------------------------------------------------

  /**
   * Run `zfs <args...>` and return raw output.
   */
  async zfs(...args: string[]): Promise<CommandResult> {
    const destructive = this.isDestructiveZfs(args);
    return this.run(ZFS_BIN, args, { destructive });
  }

  /**
   * Run `zpool <args...>` and return raw output.
   */
  async zpool(...args: string[]): Promise<CommandResult> {
    const destructive = this.isDestructiveZpool(args);
    const timeout = this.isLongRunning(args) ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
    return this.run(ZPOOL_BIN, args, { destructive, timeout });
  }

  /**
   * Attempt to run a zfs/zpool command with the `-j` (JSON) flag.
   * If the command fails (likely because the flag is unsupported),
   * fall back to running without `-j` and return a flag indicating
   * that the caller should use text parsing.
   */
  async zfsWithJson<T = unknown>(
    bin: 'zfs' | 'zpool',
    args: string[],
  ): Promise<JsonCommandResult<T>> {
    const binary = bin === 'zfs' ? ZFS_BIN : ZPOOL_BIN;

    // Try with -j first
    const jsonResult = await this.run(binary, ['-j', ...args]);
    if (jsonResult.exitCode === 0) {
      try {
        const parsed = JSON.parse(jsonResult.stdout) as T;
        return { data: parsed, usedJson: true };
      } catch {
        // JSON parse failed; fall through to text mode
      }
    }

    // Fallback: run without -j
    const textResult = await this.run(binary, args);
    if (textResult.exitCode !== 0) {
      throw new Error(`${bin} ${args.join(' ')} failed: ${textResult.stderr}`);
    }

    // Caller will need to parse the text output
    return { data: textResult.stdout as unknown as T, usedJson: false };
  }

  // -------------------------------------------------------------------------
  // Convenience wrappers for common operations
  // -------------------------------------------------------------------------

  /** List all pools with parseable output */
  async listPools(): Promise<CommandResult> {
    return this.zpool('list', '-Hp', '-o', 'name,size,allocated,free,fragmentation,capacity,dedupratio,health,guid,altroot');
  }

  /** Get detailed status of a pool */
  async poolStatus(poolName: string): Promise<CommandResult> {
    return this.zpool('status', '-v', poolName);
  }

  /** List datasets in a pool */
  async listDatasets(pool?: string): Promise<CommandResult> {
    const args = ['list', '-Hp', '-o', 'name,type,mountpoint,used,available,referenced,compressratio,compression,quota,reservation,recordsize,atime,encryption,keystatus', '-t', 'filesystem,volume'];
    if (pool) {
      args.push('-r', pool);
    }
    return this.zfs(...args);
  }

  /** List snapshots, optionally filtered by dataset */
  async listSnapshots(dataset?: string): Promise<CommandResult> {
    const args = ['list', '-Hp', '-o', 'name,used,referenced,creation,clones', '-t', 'snapshot'];
    if (dataset) {
      args.push('-r', dataset);
    }
    return this.zfs(...args);
  }

  /** Create a pool */
  async createPool(name: string, vdevArgs: string[], properties?: Record<string, string>): Promise<CommandResult> {
    const args = ['create'];
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        args.push('-o', `${key}=${value}`);
      }
    }
    args.push(name, ...vdevArgs);
    return this.run(ZPOOL_BIN, args, { destructive: true });
  }

  /** Destroy a pool */
  async destroyPool(name: string, force = false): Promise<CommandResult> {
    const args = ['destroy'];
    if (force) args.push('-f');
    args.push(name);
    return this.run(ZPOOL_BIN, args, { destructive: true });
  }

  /** Create a dataset */
  async createDataset(name: string, properties?: Record<string, string>): Promise<CommandResult> {
    const args = ['create'];
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        args.push('-o', `${key}=${value}`);
      }
    }
    args.push(name);
    return this.run(ZFS_BIN, args, { destructive: true });
  }

  /** Destroy a dataset or snapshot */
  async destroy(name: string, recursive = false): Promise<CommandResult> {
    const args = ['destroy'];
    if (recursive) args.push('-r');
    args.push(name);
    return this.run(ZFS_BIN, args, { destructive: true });
  }

  /** Create a snapshot */
  async createSnapshot(name: string, recursive = false): Promise<CommandResult> {
    const args = ['snapshot'];
    if (recursive) args.push('-r');
    args.push(name);
    return this.run(ZFS_BIN, args, { destructive: true });
  }

  /** Rollback to a snapshot */
  async rollback(snapshot: string, destroyNewer = false): Promise<CommandResult> {
    const args = ['rollback'];
    if (destroyNewer) args.push('-r');
    args.push(snapshot);
    return this.run(ZFS_BIN, args, { destructive: true });
  }

  /** Clone a snapshot into a new dataset */
  async clone(snapshot: string, target: string, properties?: Record<string, string>): Promise<CommandResult> {
    const args = ['clone'];
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        args.push('-o', `${key}=${value}`);
      }
    }
    args.push(snapshot, target);
    return this.run(ZFS_BIN, args, { destructive: true });
  }

  /** Set a property on a dataset */
  async setProperty(dataset: string, property: string, value: string): Promise<CommandResult> {
    return this.run(ZFS_BIN, ['set', `${property}=${value}`, dataset], { destructive: true });
  }

  /** Get a single property value */
  async getProperty(dataset: string, property: string): Promise<string> {
    const result = await this.zfs('get', '-Hp', '-o', 'value', property, dataset);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to get ${property} on ${dataset}: ${result.stderr}`);
    }
    return result.stdout.trim();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Determine if a zfs subcommand is destructive */
  private isDestructiveZfs(args: string[]): boolean {
    const cmd = args[0];
    return ['create', 'destroy', 'snapshot', 'rollback', 'clone', 'set', 'rename', 'send', 'receive', 'recv', 'promote', 'mount', 'unmount', 'load-key', 'unload-key', 'change-key'].includes(cmd);
  }

  /** Determine if a zpool subcommand is destructive */
  private isDestructiveZpool(args: string[]): boolean {
    const cmd = args[0];
    return ['create', 'destroy', 'add', 'remove', 'attach', 'detach', 'replace', 'import', 'export', 'scrub', 'trim', 'clear', 'offline', 'online', 'reguid', 'set', 'split', 'upgrade'].includes(cmd);
  }

  /** Determine if a command is expected to be long-running */
  private isLongRunning(args: string[]): boolean {
    const cmd = args[0];
    return ['scrub', 'trim', 'resilver'].includes(cmd);
  }
}

/** Convenience: get the singleton executor */
export function getExecutor(): ZfsExecutor {
  return ZfsExecutor.getInstance();
}
