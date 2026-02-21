/**
 * WebSocket namespace for long-running operation progress.
 *
 * Broadcasts progress updates for operations like:
 *   - Pool creation / destruction
 *   - Dataset creation / destruction
 *   - Snapshot send / receive (replication)
 *   - Pool import / export
 *
 * The pattern is fire-and-observe: a REST endpoint starts the operation
 * and returns immediately with an operation ID. The client subscribes
 * to this namespace and receives progress events keyed by that ID.
 */

import type { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

/** Namespace path */
const NAMESPACE = '/operations';

/** Reference to the namespace */
let opsNamespace: Namespace | null = null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperationType =
  | 'pool.create'
  | 'pool.destroy'
  | 'pool.import'
  | 'pool.export'
  | 'dataset.create'
  | 'dataset.destroy'
  | 'snapshot.send'
  | 'snapshot.receive'
  | 'replication';

export type OperationState = 'pending' | 'running' | 'completed' | 'failed';

export interface OperationProgress {
  /** Unique operation identifier */
  id: string;
  /** Type of operation */
  type: OperationType;
  /** Current state */
  state: OperationState;
  /** Target resource (pool name, dataset path, etc.) */
  target: string;
  /** Percentage complete (0-100), if known */
  percentage?: number;
  /** Human-readable status message */
  message?: string;
  /** Bytes transferred (for send/receive) */
  bytesTransferred?: number;
  /** Estimated total bytes (for send/receive) */
  bytesTotal?: number;
  /** When the operation started */
  startedAt: string;
  /** When the operation completed (if done) */
  completedAt?: string;
  /** Error message (if failed) */
  error?: string;
  /** Username who initiated the operation */
  initiatedBy: string;
}

/** In-memory store of active operations */
const activeOperations = new Map<string, OperationProgress>();

// ---------------------------------------------------------------------------
// Public setup
// ---------------------------------------------------------------------------

/**
 * Register the /operations namespace on the Socket.IO server.
 */
export function setupOperationsNamespace(io: SocketIOServer): void {
  opsNamespace = io.of(NAMESPACE);

  opsNamespace.on('connection', (socket: Socket) => {
    console.log(`[ws:ops] Client connected: ${socket.user?.username ?? 'unknown'}`);

    // On connect, send all currently active operations
    socket.on('list', () => {
      const operations = Array.from(activeOperations.values());
      socket.emit('operations', operations);
    });

    // Subscribe to updates for a specific operation
    socket.on('subscribe', (operationId: string) => {
      if (typeof operationId !== 'string') return;
      socket.join(`op:${operationId}`);

      // Send current state immediately
      const op = activeOperations.get(operationId);
      if (op) {
        socket.emit('progress', op);
      }
    });

    // Unsubscribe from a specific operation
    socket.on('unsubscribe', (operationId: string) => {
      if (typeof operationId !== 'string') return;
      socket.leave(`op:${operationId}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Operation lifecycle (called from route handlers / services)
// ---------------------------------------------------------------------------

/**
 * Create a new tracked operation.
 *
 * @returns The operation ID for tracking.
 */
export function createOperation(
  type: OperationType,
  target: string,
  initiatedBy: string,
): string {
  const id = uuidv4();

  const operation: OperationProgress = {
    id,
    type,
    state: 'pending',
    target,
    startedAt: new Date().toISOString(),
    initiatedBy,
  };

  activeOperations.set(id, operation);
  broadcastProgress(operation);

  return id;
}

/**
 * Update an operation's progress.
 */
export function updateOperation(
  id: string,
  updates: Partial<Pick<OperationProgress, 'state' | 'percentage' | 'message' | 'bytesTransferred' | 'bytesTotal' | 'error' | 'completedAt'>>,
): void {
  const operation = activeOperations.get(id);
  if (!operation) return;

  Object.assign(operation, updates);

  // Auto-set completedAt when the operation finishes
  if ((updates.state === 'completed' || updates.state === 'failed') && !operation.completedAt) {
    operation.completedAt = new Date().toISOString();
  }

  broadcastProgress(operation);

  // Remove completed/failed operations from active map after a delay
  // so late-joining clients can still see the final state
  if (operation.state === 'completed' || operation.state === 'failed') {
    setTimeout(() => {
      activeOperations.delete(id);
    }, 60_000); // Keep for 1 minute
  }
}

/**
 * Mark an operation as running.
 */
export function startOperation(id: string, message?: string): void {
  updateOperation(id, { state: 'running', message });
}

/**
 * Mark an operation as completed.
 */
export function completeOperation(id: string, message?: string): void {
  updateOperation(id, { state: 'completed', percentage: 100, message });
}

/**
 * Mark an operation as failed.
 */
export function failOperation(id: string, error: string): void {
  updateOperation(id, { state: 'failed', error });
}

// ---------------------------------------------------------------------------
// Broadcasting
// ---------------------------------------------------------------------------

/**
 * Broadcast an operation progress update to all connected clients
 * and to the operation-specific room.
 */
function broadcastProgress(operation: OperationProgress): void {
  if (!opsNamespace) return;

  // Broadcast to operation-specific room
  opsNamespace.to(`op:${operation.id}`).emit('progress', operation);

  // Also broadcast to all connected clients (for the operations list)
  opsNamespace.emit('operation-update', operation);
}

/**
 * Clean up all operations (for server shutdown).
 */
export function shutdownOperations(): void {
  activeOperations.clear();
}
