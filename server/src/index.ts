/**
 * ZFS Storage Manager - Server Entry Point
 *
 * Initializes the environment, database, HTTP server, and WebSocket layer,
 * then starts listening for connections.
 */

import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { getDb, closeDb } from './db/connection.js';
import { runMigrations } from './db/migrations/runner.js';
import initialMigration from './db/migrations/001_initial.js';
import { setupWebSocket } from './websocket/index.js';
import { shutdownIostat } from './websocket/iostat.js';
import { shutdownScrub } from './websocket/scrub.js';
import { shutdownOperations } from './websocket/operations.js';
import { purgeExpiredSessions } from './middleware/auth.js';

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

console.log('='.repeat(60));
console.log('  ZFS Storage Manager - Server');
console.log(`  Environment : ${config.nodeEnv}`);
console.log(`  Port        : ${config.port}`);
console.log(`  Database    : ${config.dbPath}`);
console.log(`  CORS Origin : ${config.corsOrigin}`);
console.log('='.repeat(60));

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

console.log('[boot] Initializing database...');
getDb(); // Ensure the database file and connection exist

// Run migrations
runMigrations([initialMigration]);
console.log('[boot] Database ready');

// ---------------------------------------------------------------------------
// Create Express app and HTTP server
// ---------------------------------------------------------------------------

const app = createApp();
const httpServer = createServer(app);

// ---------------------------------------------------------------------------
// Attach WebSocket (Socket.IO)
// ---------------------------------------------------------------------------

const io = setupWebSocket(httpServer);

// ---------------------------------------------------------------------------
// Periodic housekeeping
// ---------------------------------------------------------------------------

// Purge expired sessions every 15 minutes
const sessionPurgeInterval = setInterval(() => {
  try {
    const purged = purgeExpiredSessions();
    if (purged > 0) {
      console.log(`[housekeeping] Purged ${purged} expired session(s)`);
    }
  } catch (err) {
    console.error('[housekeeping] Failed to purge sessions:', err);
  }
}, 15 * 60 * 1000);

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

httpServer.listen(config.port, () => {
  console.log(`[boot] Server listening on http://0.0.0.0:${config.port}`);
  console.log(`[boot] API base: http://localhost:${config.port}/api`);
  console.log(`[boot] Health check: http://localhost:${config.port}/api/health`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string) {
  console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  httpServer.close(() => {
    console.log('[shutdown] HTTP server closed');
  });

  // Stop periodic tasks
  clearInterval(sessionPurgeInterval);

  // Shut down WebSocket namespaces
  shutdownIostat();
  shutdownScrub();
  shutdownOperations();

  // Close Socket.IO
  io.close(() => {
    console.log('[shutdown] WebSocket server closed');
  });

  // Close database
  closeDb();
  console.log('[shutdown] Database connection closed');

  // Exit after a timeout if graceful shutdown stalls
  setTimeout(() => {
    console.error('[shutdown] Forceful shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] Unhandled rejection:', reason);
});
