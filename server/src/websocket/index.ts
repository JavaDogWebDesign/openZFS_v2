/**
 * WebSocket (Socket.IO) setup and namespace registration.
 *
 * Provides real-time communication for:
 *   - Live IO statistics (zpool iostat -n 1)
 *   - Scrub progress updates
 *   - Long-running operation progress (create, destroy, send/receive)
 *
 * Authentication: every Socket.IO connection must present a valid session
 * token. The token is read from the `session_token` cookie or from the
 * `auth.token` handshake field.
 */

import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import type { SessionInfo } from '@zfs-manager/shared';
import { lookupSession } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { setupIostatNamespace } from './iostat.js';
import { setupScrubNamespace } from './scrub.js';
import { setupOperationsNamespace } from './operations.js';

// ---------------------------------------------------------------------------
// Extend Socket.IO types with our session data
// ---------------------------------------------------------------------------

declare module 'socket.io' {
  interface Socket {
    /** Authenticated user data, populated by the auth middleware */
    user?: SessionInfo;
  }
}

/** Type for the session lookup function passed to this module */
export type SessionLookupFn = (token: string) => SessionInfo | null;

// ---------------------------------------------------------------------------
// Public setup function
// ---------------------------------------------------------------------------

/**
 * Create and configure the Socket.IO server, attach it to the HTTP server,
 * and register all namespace handlers.
 *
 * @param httpServer     - The Node.js HTTP server instance.
 * @param sessionLookup  - Function to look up a session by token.
 *                         Defaults to the database-backed `lookupSession`.
 * @returns The configured Socket.IO Server instance.
 */
export function setupWebSocket(
  httpServer: HttpServer,
  sessionLookup: SessionLookupFn = lookupSession,
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    // Only use WebSocket transport (skip long-polling for better performance)
    transports: ['websocket'],
    // Ping every 25 seconds, timeout after 20 seconds
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // -------------------------------------------------------------------------
  // Global authentication middleware
  // -------------------------------------------------------------------------

  io.use((socket, next) => {
    // Try to get token from auth handshake data first, then from cookie
    const token: string | undefined =
      (socket.handshake.auth as { token?: string })?.token ??
      parseCookies(socket.handshake.headers.cookie ?? '')['session_token'];

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    const session = sessionLookup(token);

    if (!session) {
      next(new Error('Invalid or expired session'));
      return;
    }

    socket.user = session;
    next();
  });

  // -------------------------------------------------------------------------
  // Register namespace handlers
  // -------------------------------------------------------------------------

  // Default namespace: general connection management
  io.on('connection', (socket) => {
    console.log(`[ws] Client connected: ${socket.user?.username ?? 'unknown'} (${socket.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`[ws] Client disconnected: ${socket.user?.username ?? 'unknown'} (${reason})`);
    });
  });

  // Domain-specific namespaces
  setupIostatNamespace(io);
  setupScrubNamespace(io);
  setupOperationsNamespace(io);

  console.log('[ws] WebSocket server initialized');

  return io;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal cookie parser for the WebSocket handshake.
 * (We cannot rely on the Express cookie-parser middleware here.)
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const pair of cookieHeader.split(';')) {
    const [key, ...valueParts] = pair.trim().split('=');
    if (key) {
      cookies[key.trim()] = valueParts.join('=').trim();
    }
  }

  return cookies;
}
