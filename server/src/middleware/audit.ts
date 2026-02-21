/**
 * Audit logging middleware factory.
 *
 * Creates Express middleware that records an entry in the `audit_log` table
 * after the response has been sent.  This approach avoids slowing down the
 * actual request while still capturing the outcome (success / failure).
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuditAction } from '@zfs-manager/shared';
import { getDb } from '../db/connection.js';

/**
 * Optional function to extract the audit target from the request.
 * Defaults to `req.params.name ?? req.params.id ?? req.path`.
 */
type TargetExtractor = (req: Request) => string;

/**
 * Optional function to extract additional detail from the request.
 * Serialized as JSON in the details column.
 */
type DetailsExtractor = (req: Request) => unknown;

export interface AuditOptions {
  /** Override the default target extractor */
  target?: TargetExtractor;
  /** Supply additional details to store alongside the entry */
  details?: DetailsExtractor;
}

/**
 * Create audit logging middleware for a specific action.
 *
 * @param action  - The audit action identifier (e.g. 'pool.create').
 * @param options - Optional target / details extractors.
 * @returns Express middleware that logs after the response finishes.
 *
 * @example
 *   router.post('/', requireAuth, auditLog('pool.create'), createPoolHandler);
 */
export function auditLog(action: AuditAction, options: AuditOptions = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Capture the original res.json so we can inspect what was sent
    const originalJson = res.json.bind(res);

    res.json = function auditedJson(body: unknown) {
      // Fire-and-forget: write the audit row after the response is sent
      setImmediate(() => {
        try {
          const db = getDb();
          const username = req.user?.username ?? 'anonymous';
          const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

          // Determine the target resource
          const target = options.target
            ? options.target(req)
            : (req.params.name ?? req.params.id ?? req.path);

          // Determine additional details
          const details = options.details
            ? JSON.stringify(options.details(req))
            : null;

          // If the response body has `success: false`, mark as failed
          const success = (body as Record<string, unknown>)?.success !== false ? 1 : 0;
          const errorMessage = success
            ? null
            : ((body as Record<string, unknown>)?.error as Record<string, unknown>)?.message ?? null;

          db.prepare(`
            INSERT INTO audit_log (username, action, target, details, ip, success, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(username, action, target, details, ip, success, errorMessage);
        } catch {
          // Swallow errors in audit logging so they never impact the response
          console.error('[audit] Failed to write audit log entry');
        }
      });

      return originalJson(body);
    } as typeof res.json;

    next();
  };
}
