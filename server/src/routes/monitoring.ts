/**
 * Monitoring and observability routes.
 *
 * GET   /api/monitoring/arc                    - ARC statistics
 * GET   /api/monitoring/iostat                 - IO statistics (one-shot)
 * GET   /api/monitoring/alerts                 - List alerts
 * PATCH /api/monitoring/alerts/:id/acknowledge - Acknowledge an alert
 * GET   /api/monitoring/system                 - System information
 * GET   /api/monitoring/audit-log              - Audit log entries
 */

import { Router } from 'express';
import { z } from 'zod';
import type {
  ApiResponse,
  ARCStats,
  IOStatEntry,
  Alert,
  AuditEntry,
  SystemInfo,
} from '@zfs-manager/shared';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import * as monitoringService from '../services/monitoringService.js';
import { getDb } from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const AlertsQuery = z.object({
  acknowledged: z.enum(['true', 'false']).optional(),
});

const AuditLogQuery = z.object({
  page: z.string().optional().default('1'),
  pageSize: z.string().optional().default('50'),
  username: z.string().optional(),
  action: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /arc - ARC statistics
// ---------------------------------------------------------------------------

router.get('/arc', requireAuth, async (_req, res, next) => {
  try {
    const stats = await monitoringService.getArcStats();
    const response: ApiResponse<ARCStats> = { success: true, data: stats };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /iostat - IO statistics
// ---------------------------------------------------------------------------

router.get('/iostat', requireAuth, async (_req, res, next) => {
  try {
    const entries = await monitoringService.getIostat();
    const response: ApiResponse<IOStatEntry[]> = { success: true, data: entries };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /alerts - List alerts
// ---------------------------------------------------------------------------

router.get(
  '/alerts',
  requireAuth,
  validateQuery(AlertsQuery),
  async (req, res, next) => {
    try {
      const query = (req as unknown as { validatedQuery: z.infer<typeof AlertsQuery> }).validatedQuery;

      let acknowledged: boolean | undefined;
      if (query?.acknowledged === 'true') acknowledged = true;
      else if (query?.acknowledged === 'false') acknowledged = false;

      const alerts = monitoringService.getAlerts(acknowledged);
      const response: ApiResponse<Alert[]> = { success: true, data: alerts };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /alerts/:id/acknowledge - Acknowledge an alert
// ---------------------------------------------------------------------------

router.patch(
  '/alerts/:id/acknowledge',
  requireAuth,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const username = req.user?.username;

      if (!username) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const alert = monitoringService.acknowledgeAlert(id, username);
      const response: ApiResponse<Alert> = {
        success: true,
        data: alert,
        message: 'Alert acknowledged',
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /system - System information
// ---------------------------------------------------------------------------

router.get('/system', requireAuth, async (_req, res, next) => {
  try {
    const info = await monitoringService.getSystemInfo();
    const response: ApiResponse<SystemInfo> = { success: true, data: info };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /audit-log - Audit log entries
// ---------------------------------------------------------------------------

router.get(
  '/audit-log',
  requireAuth,
  requireAdmin,
  validateQuery(AuditLogQuery),
  async (req, res, next) => {
    try {
      const query = (req as unknown as { validatedQuery: z.infer<typeof AuditLogQuery> }).validatedQuery;

      const page = Math.max(1, parseInt(query?.page ?? '1', 10));
      const pageSize = Math.min(200, Math.max(1, parseInt(query?.pageSize ?? '50', 10)));
      const offset = (page - 1) * pageSize;

      const db = getDb();

      // Build dynamic query
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (query?.username) {
        conditions.push('username = ?');
        params.push(query.username);
      }
      if (query?.action) {
        conditions.push('action = ?');
        params.push(query.action);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_log ${whereClause}`).get(...params) as { total: number };
      const total = countRow.total;

      // Get page of results
      const rows = db.prepare(`
        SELECT * FROM audit_log ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, offset) as Array<{
        id: number;
        timestamp: string;
        username: string;
        action: string;
        target: string;
        details: string | null;
        ip: string | null;
        success: number;
        error_message: string | null;
      }>;

      const entries: AuditEntry[] = rows.map((row) => ({
        id: String(row.id),
        timestamp: row.timestamp,
        username: row.username,
        action: row.action as AuditEntry['action'],
        target: row.target,
        details: row.details ?? undefined,
        ip: row.ip ?? undefined,
        success: row.success === 1,
        errorMessage: row.error_message ?? undefined,
      }));

      res.json({
        success: true,
        data: entries,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
