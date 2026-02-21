/**
 * WebSocket namespace for live IO statistics.
 *
 * Manages a long-lived `zpool iostat 1` child process that streams
 * parsed IO statistics to all subscribed clients.  The process is
 * started when the first client subscribes and stopped when the last
 * client unsubscribes, conserving system resources.
 */

import type { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { IOStatEntry } from '@zfs-manager/shared';
import { parseZpoolIostat } from '../services/zfsParser.js';

const ZPOOL_BIN = '/usr/sbin/zpool';

/** Namespace path for iostat */
const NAMESPACE = '/iostat';

/** Interval in seconds for iostat sampling */
const IOSTAT_INTERVAL = 1;

/** The single shared zpool iostat process */
let iostatProcess: ChildProcess | null = null;

/** Number of clients currently subscribed */
let subscriberCount = 0;

/** Reference to the namespace for broadcasting */
let iostatNamespace: Namespace | null = null;

// ---------------------------------------------------------------------------
// Public setup
// ---------------------------------------------------------------------------

/**
 * Register the /iostat namespace on the Socket.IO server.
 */
export function setupIostatNamespace(io: SocketIOServer): void {
  iostatNamespace = io.of(NAMESPACE);

  iostatNamespace.on('connection', (socket: Socket) => {
    console.log(`[ws:iostat] Client connected: ${socket.user?.username ?? 'unknown'}`);

    // Client subscribes to iostat stream
    socket.on('subscribe', () => {
      subscriberCount++;
      console.log(`[ws:iostat] Subscribe (${subscriberCount} active)`);

      if (subscriberCount === 1) {
        startIostatProcess();
      }
    });

    // Client unsubscribes from iostat stream
    socket.on('unsubscribe', () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      console.log(`[ws:iostat] Unsubscribe (${subscriberCount} active)`);

      if (subscriberCount === 0) {
        stopIostatProcess();
      }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      console.log(`[ws:iostat] Client disconnected (${subscriberCount} active)`);

      if (subscriberCount === 0) {
        stopIostatProcess();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

/**
 * Start the `zpool iostat` child process.
 * Output is parsed line-by-line and broadcast to all subscribers.
 */
function startIostatProcess(): void {
  if (iostatProcess) {
    return; // Already running
  }

  console.log('[ws:iostat] Starting zpool iostat process');

  iostatProcess = spawn(ZPOOL_BIN, ['iostat', '-Hp', String(IOSTAT_INTERVAL)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let buffer = '';

  iostatProcess.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // Keep incomplete last line in buffer

    if (lines.length === 0) return;

    // Parse the accumulated lines into IOStatEntry objects
    const stdout = lines.join('\n');
    try {
      const entries = parseZpoolIostat(stdout);

      if (entries.length > 0 && iostatNamespace) {
        iostatNamespace.emit('data', entries);
      }
    } catch (err) {
      console.error('[ws:iostat] Parse error:', err);
    }
  });

  iostatProcess.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) {
      console.warn('[ws:iostat] stderr:', msg);
    }
  });

  iostatProcess.on('close', (code) => {
    console.log(`[ws:iostat] Process exited with code ${code}`);
    iostatProcess = null;

    // If there are still subscribers, restart after a brief delay
    if (subscriberCount > 0) {
      setTimeout(() => {
        if (subscriberCount > 0) {
          startIostatProcess();
        }
      }, 2000);
    }
  });

  iostatProcess.on('error', (err) => {
    console.error('[ws:iostat] Process error:', err.message);
    iostatProcess = null;
  });
}

/**
 * Stop the `zpool iostat` child process.
 */
function stopIostatProcess(): void {
  if (!iostatProcess) {
    return;
  }

  console.log('[ws:iostat] Stopping zpool iostat process');
  iostatProcess.kill('SIGTERM');
  iostatProcess = null;
}

/**
 * Force-stop the iostat process (for server shutdown).
 */
export function shutdownIostat(): void {
  subscriberCount = 0;
  stopIostatProcess();
}
