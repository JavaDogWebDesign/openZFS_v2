/**
 * Express application factory.
 *
 * Creates and configures the Express app with all middleware and routes.
 * The app is exported separately from the HTTP server to facilitate testing.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { ApiResponse } from '@zfs-manager/shared';
import { config } from './config/index.js';
import { csrfProtection } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import poolRoutes from './routes/pools.js';
import datasetRoutes from './routes/datasets.js';
import snapshotRoutes from './routes/snapshots.js';
import diskRoutes from './routes/disks.js';
import userRoutes from './routes/users.js';
import groupRoutes from './routes/groups.js';
import shareRoutes from './routes/shares.js';
import monitoringRoutes from './routes/monitoring.js';
import systemRoutes from './routes/system.js';

/**
 * Create and configure the Express application.
 */
export function createApp(): express.Application {
  const app = express();

  // ---------------------------------------------------------------------------
  // Security middleware
  // ---------------------------------------------------------------------------

  // Helmet sets various HTTP headers for security
  app.use(helmet({
    // Disable contentSecurityPolicy in dev so Vite HMR works
    contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false,
  }));

  // CORS: in development allow any origin (LAN access), in production use configured origin
  app.use(cors({
    origin: config.nodeEnv === 'development' ? true : config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  }));

  // Trust proxy if configured (for correct req.ip behind nginx)
  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  // ---------------------------------------------------------------------------
  // Body parsing & cookies
  // ---------------------------------------------------------------------------

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // ---------------------------------------------------------------------------
  // CSRF protection (double-submit cookie pattern)
  // ---------------------------------------------------------------------------

  app.use('/api', csrfProtection);

  // ---------------------------------------------------------------------------
  // Rate limiting (applies to all /api routes)
  // ---------------------------------------------------------------------------

  app.use('/api', apiLimiter);

  // ---------------------------------------------------------------------------
  // Health check (unauthenticated, useful for load balancers)
  // ---------------------------------------------------------------------------

  app.get('/api/health', (_req, res) => {
    const response: ApiResponse<{ status: string; uptime: number }> = {
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime(),
      },
    };
    res.json(response);
  });

  // ---------------------------------------------------------------------------
  // API routes
  // ---------------------------------------------------------------------------

  app.use('/api/auth', authRoutes);
  app.use('/api/pools', poolRoutes);
  app.use('/api/datasets', datasetRoutes);
  app.use('/api/snapshots', snapshotRoutes);
  app.use('/api/disks', diskRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/shares', shareRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/system', systemRoutes);

  // ---------------------------------------------------------------------------
  // 404 handler for unmatched API routes
  // ---------------------------------------------------------------------------

  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'API endpoint not found',
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Centralized error handler (must be last)
  // ---------------------------------------------------------------------------

  app.use(errorHandler);

  return app;
}
