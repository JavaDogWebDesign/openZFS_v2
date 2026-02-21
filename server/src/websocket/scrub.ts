/**
 * WebSocket namespace for scrub progress updates.
 *
 * Clients connect to the /scrub namespace and subscribe to a specific
 * pool's scrub progress. While at least one client is subscribed to a
 * pool, the server periodically polls `zpool status` and broadcasts
 * the parsed scrub status.
 */

import type { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import type { ScrubStatus } from '@zfs-manager/shared';
import { getScrubStatus } from '../services/scrubService.js';

/** Namespace path */
const NAMESPACE = '/scrub';

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 3000;

/** Map of pool name -> set of subscribed socket IDs */
const poolSubscribers = new Map<string, Set<string>>();

/** Map of pool name -> polling interval handle */
const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();

/** Reference to the namespace */
let scrubNamespace: Namespace | null = null;

// ---------------------------------------------------------------------------
// Public setup
// ---------------------------------------------------------------------------

/**
 * Register the /scrub namespace on the Socket.IO server.
 */
export function setupScrubNamespace(io: SocketIOServer): void {
  scrubNamespace = io.of(NAMESPACE);

  scrubNamespace.on('connection', (socket: Socket) => {
    console.log(`[ws:scrub] Client connected: ${socket.user?.username ?? 'unknown'}`);

    // Subscribe to a pool's scrub progress
    socket.on('subscribe', (poolName: string) => {
      if (typeof poolName !== 'string' || !poolName.trim()) return;

      const pool = poolName.trim();
      socket.join(`pool:${pool}`);

      if (!poolSubscribers.has(pool)) {
        poolSubscribers.set(pool, new Set());
      }
      poolSubscribers.get(pool)!.add(socket.id);

      console.log(`[ws:scrub] ${socket.user?.username} subscribed to ${pool}`);

      // Start polling if this is the first subscriber for this pool
      if (!pollingIntervals.has(pool)) {
        startPolling(pool);
      }
    });

    // Unsubscribe from a pool's scrub progress
    socket.on('unsubscribe', (poolName: string) => {
      if (typeof poolName !== 'string') return;
      const pool = poolName.trim();

      socket.leave(`pool:${pool}`);
      poolSubscribers.get(pool)?.delete(socket.id);

      if (poolSubscribers.get(pool)?.size === 0) {
        poolSubscribers.delete(pool);
        stopPolling(pool);
      }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      // Remove this socket from all pool subscriber sets
      for (const [pool, subscribers] of poolSubscribers.entries()) {
        subscribers.delete(socket.id);

        if (subscribers.size === 0) {
          poolSubscribers.delete(pool);
          stopPolling(pool);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/**
 * Start polling scrub status for a pool.
 */
function startPolling(pool: string): void {
  if (pollingIntervals.has(pool)) return;

  console.log(`[ws:scrub] Starting poll for pool "${pool}"`);

  const interval = setInterval(async () => {
    try {
      const status = await getScrubStatus(pool);
      broadcastScrubStatus(pool, status);

      // Stop polling if the scrub is no longer running
      if (status.state === 'finished' || status.state === 'canceled' || status.state === 'none') {
        // Send one final update, then stop
        stopPolling(pool);
      }
    } catch (err) {
      console.error(`[ws:scrub] Poll error for ${pool}:`, err);
    }
  }, POLL_INTERVAL_MS);

  pollingIntervals.set(pool, interval);
}

/**
 * Stop polling scrub status for a pool.
 */
function stopPolling(pool: string): void {
  const interval = pollingIntervals.get(pool);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(pool);
    console.log(`[ws:scrub] Stopped poll for pool "${pool}"`);
  }
}

/**
 * Broadcast a scrub status update to all subscribers of a pool.
 */
function broadcastScrubStatus(pool: string, status: ScrubStatus): void {
  scrubNamespace?.to(`pool:${pool}`).emit('status', status);
}

/**
 * Stop all polling (for server shutdown).
 */
export function shutdownScrub(): void {
  for (const pool of pollingIntervals.keys()) {
    stopPolling(pool);
  }
  poolSubscribers.clear();
}
