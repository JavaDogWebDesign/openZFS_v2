/**
 * Snapshot management routes.
 *
 * GET    /api/snapshots             - List snapshots (optionally by dataset query)
 * POST   /api/snapshots             - Create a snapshot
 * DELETE /api/snapshots/:id         - Destroy a snapshot
 * POST   /api/snapshots/:id/rollback - Rollback to a snapshot
 * POST   /api/snapshots/:id/clone    - Clone a snapshot
 */

import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, Snapshot } from '@zfs-manager/shared';
import { validate, validateQuery } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { getExecutor } from '../services/zfsExecutor.js';
import { parseSnapshotList } from '../services/zfsParser.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ListSnapshotsQuery = z.object({
  dataset: z.string().optional(),
});

const CreateSnapshotSchema = z.object({
  /** Full snapshot name: pool/dataset@snapname */
  name: z.string().min(1).regex(/.+@.+/, 'Snapshot name must be in format dataset@snapname'),
  recursive: z.boolean().optional().default(false),
});

const CloneSnapshotSchema = z.object({
  target: z.string().min(1, 'Target dataset name is required'),
  properties: z.record(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// GET / - List snapshots
// ---------------------------------------------------------------------------

router.get(
  '/',
  requireAuth,
  validateQuery(ListSnapshotsQuery),
  async (req, res, next) => {
    try {
      const dataset = (req as unknown as { validatedQuery: z.infer<typeof ListSnapshotsQuery> }).validatedQuery?.dataset;
      const executor = getExecutor();
      const result = await executor.listSnapshots(dataset);

      if (result.exitCode !== 0 && !result.stdout.trim()) {
        const response: ApiResponse<Snapshot[]> = { success: true, data: [] };
        res.json(response);
        return;
      }

      const snapshots = parseSnapshotList(result.stdout);
      const response: ApiResponse<Snapshot[]> = { success: true, data: snapshots };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST / - Create snapshot
// ---------------------------------------------------------------------------

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(CreateSnapshotSchema),
  auditLog('snapshot.create', {
    target: (req) => req.body.name,
  }),
  async (req, res, next) => {
    try {
      const { name, recursive } = req.body as z.infer<typeof CreateSnapshotSchema>;

      const executor = getExecutor();
      const result = await executor.createSnapshot(name, recursive);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'SNAPSHOT_CREATE_FAILED', `Failed to create snapshot: ${result.stderr}`);
      }

      // Fetch the created snapshot
      const dataset = name.split('@')[0];
      const listResult = await executor.listSnapshots(dataset);
      const snapshots = parseSnapshotList(listResult.stdout);
      const snapshot = snapshots.find((s) => s.name === name);

      const response: ApiResponse<Snapshot> = {
        success: true,
        data: snapshot!,
        message: `Snapshot "${name}" created successfully`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:id - Destroy snapshot
// ---------------------------------------------------------------------------

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  auditLog('snapshot.destroy', {
    target: (req) => decodeURIComponent(req.params.id),
  }),
  async (req, res, next) => {
    try {
      const snapshotName = decodeURIComponent(req.params.id);

      const executor = getExecutor();
      const result = await executor.destroy(snapshotName);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'SNAPSHOT_DESTROY_FAILED', `Failed to destroy snapshot: ${result.stderr}`);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Snapshot "${snapshotName}" destroyed`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:id/rollback - Rollback to snapshot
// ---------------------------------------------------------------------------

router.post(
  '/:id/rollback',
  requireAuth,
  requireAdmin,
  auditLog('snapshot.rollback', {
    target: (req) => decodeURIComponent(req.params.id),
  }),
  async (req, res, next) => {
    try {
      const snapshotName = decodeURIComponent(req.params.id);
      const destroyNewer = req.query.destroyNewer === 'true';

      const executor = getExecutor();
      const result = await executor.rollback(snapshotName, destroyNewer);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'SNAPSHOT_ROLLBACK_FAILED', `Failed to rollback: ${result.stderr}`);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Rolled back to snapshot "${snapshotName}"`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:id/clone - Clone snapshot
// ---------------------------------------------------------------------------

router.post(
  '/:id/clone',
  requireAuth,
  requireAdmin,
  validate(CloneSnapshotSchema),
  auditLog('snapshot.clone', {
    target: (req) => decodeURIComponent(req.params.id),
    details: (req) => ({ target: req.body.target }),
  }),
  async (req, res, next) => {
    try {
      const snapshotName = decodeURIComponent(req.params.id);
      const { target, properties } = req.body as z.infer<typeof CloneSnapshotSchema>;

      const executor = getExecutor();
      const result = await executor.clone(snapshotName, target, properties);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'SNAPSHOT_CLONE_FAILED', `Failed to clone snapshot: ${result.stderr}`);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Snapshot "${snapshotName}" cloned to "${target}"`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
