/**
 * Pool management routes.
 *
 * GET    /api/pools              - List all pools
 * POST   /api/pools              - Create a new pool
 * GET    /api/pools/:name        - Get pool detail
 * DELETE /api/pools/:name        - Destroy a pool
 * POST   /api/pools/:name/scrub  - Start scrub
 * POST   /api/pools/:name/trim   - Start TRIM
 * GET    /api/pools/:name/status - Get detailed status
 * POST   /api/pools/import       - Import a pool
 * POST   /api/pools/:name/export - Export a pool
 */

import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, Pool, PoolDetail } from '@zfs-manager/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { getExecutor } from '../services/zfsExecutor.js';
import { parsePoolList, parsePoolStatus } from '../services/zfsParser.js';
import { startScrub } from '../services/scrubService.js';
import { startTrim } from '../services/trimService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const VdevSpec = z.object({
  type: z.string(),
  disks: z.array(z.string()).min(1),
});

const CreatePoolSchema = z.object({
  name: z.string().min(1).max(255).regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/, 'Invalid pool name'),
  vdevs: z.array(VdevSpec).min(1, 'At least one vdev specification is required'),
  options: z.record(z.string()).optional(),
  mountpoint: z.string().optional(),
});

const ImportPoolSchema = z.object({
  name: z.string().optional(),
  guid: z.string().optional(),
  force: z.boolean().optional().default(false),
  altroot: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET / - List all pools
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const executor = getExecutor();
    const result = await executor.listPools();

    if (result.exitCode !== 0 && !result.stdout.trim()) {
      // No pools exist -- return empty array
      const response: ApiResponse<Pool[]> = { success: true, data: [] };
      res.json(response);
      return;
    }

    const pools = parsePoolList(result.stdout);
    const response: ApiResponse<Pool[]> = { success: true, data: pools };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / - Create pool
// ---------------------------------------------------------------------------

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(CreatePoolSchema),
  auditLog('pool.create', {
    target: (req) => req.body.name,
    details: (req) => ({ vdevs: req.body.vdevs, options: req.body.options }),
  }),
  async (req, res, next) => {
    try {
      const { name, vdevs, options } = req.body as z.infer<typeof CreatePoolSchema>;

      // Flatten vdev specs into zpool create args: e.g. ["mirror", "sdb", "sdc", "mirror", "sdd", "sde"]
      const vdevArgs: string[] = [];
      for (const vdev of vdevs) {
        // 'stripe' means no topology keyword — just list the disks
        if (vdev.type !== 'stripe') {
          vdevArgs.push(vdev.type);
        }
        vdevArgs.push(...vdev.disks);
      }

      const executor = getExecutor();
      const result = await executor.createPool(name, vdevArgs, options);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'POOL_CREATE_FAILED', `Failed to create pool: ${result.stderr}`);
      }

      // Fetch the newly created pool
      const listResult = await executor.listPools();
      const pools = parsePoolList(listResult.stdout);
      const pool = pools.find((p) => p.name === name);

      const response: ApiResponse<Pool> = {
        success: true,
        data: pool!,
        message: `Pool "${name}" created successfully`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:name - Get pool detail
// ---------------------------------------------------------------------------

router.get('/:name', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.params;
    const executor = getExecutor();

    // Get basic pool info
    const listResult = await executor.listPools();
    const pools = parsePoolList(listResult.stdout);
    const basePool = pools.find((p) => p.name === name);

    if (!basePool) {
      throw new AppError(404, 'POOL_NOT_FOUND', `Pool "${name}" not found`);
    }

    // Get detailed status
    const statusResult = await executor.poolStatus(name);
    const detail = parsePoolStatus(statusResult.stdout, basePool);

    const response: ApiResponse<PoolDetail> = { success: true, data: detail };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:name - Destroy pool
// ---------------------------------------------------------------------------

router.delete(
  '/:name',
  requireAuth,
  requireAdmin,
  auditLog('pool.destroy', { target: (req) => req.params.name }),
  async (req, res, next) => {
    try {
      const { name } = req.params;
      const force = req.query.force === 'true';

      const executor = getExecutor();
      const result = await executor.destroyPool(name, force);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'POOL_DESTROY_FAILED', `Failed to destroy pool: ${result.stderr}`);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Pool "${name}" destroyed`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:name/scrub - Start scrub
// ---------------------------------------------------------------------------

router.post(
  '/:name/scrub',
  requireAuth,
  requireAdmin,
  auditLog('pool.scrub', { target: (req) => req.params.name }),
  async (req, res, next) => {
    try {
      await startScrub(req.params.name);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Scrub started on pool "${req.params.name}"`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:name/trim - Start TRIM
// ---------------------------------------------------------------------------

router.post(
  '/:name/trim',
  requireAuth,
  requireAdmin,
  auditLog('pool.trim', { target: (req) => req.params.name }),
  async (req, res, next) => {
    try {
      await startTrim(req.params.name);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `TRIM started on pool "${req.params.name}"`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:name/status - Get detailed pool status
// ---------------------------------------------------------------------------

router.get('/:name/status', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.params;
    const executor = getExecutor();

    const statusResult = await executor.poolStatus(name);
    if (statusResult.exitCode !== 0) {
      throw new AppError(404, 'POOL_NOT_FOUND', `Pool "${name}" not found or inaccessible`);
    }

    const detail = parsePoolStatus(statusResult.stdout);

    const response: ApiResponse<PoolDetail> = { success: true, data: detail };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /import - Import a pool
// ---------------------------------------------------------------------------

router.post(
  '/import',
  requireAuth,
  requireAdmin,
  validate(ImportPoolSchema),
  auditLog('pool.import', {
    target: (req) => req.body.name ?? req.body.guid ?? 'unknown',
  }),
  async (req, res, next) => {
    try {
      const { name, guid, force, altroot } = req.body as z.infer<typeof ImportPoolSchema>;

      const executor = getExecutor();
      const args = ['import'];

      if (force) args.push('-f');
      if (altroot) args.push('-R', altroot);

      if (guid) {
        args.push(guid);
      } else if (name) {
        args.push(name);
      } else {
        throw new AppError(400, 'IMPORT_INVALID', 'Either pool name or GUID is required');
      }

      const result = await executor.zpool(...args);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'POOL_IMPORT_FAILED', `Failed to import pool: ${result.stderr}`);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Pool imported successfully',
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:name/export - Export a pool
// ---------------------------------------------------------------------------

router.post(
  '/:name/export',
  requireAuth,
  requireAdmin,
  auditLog('pool.export', { target: (req) => req.params.name }),
  async (req, res, next) => {
    try {
      const { name } = req.params;
      const force = req.query.force === 'true';

      const executor = getExecutor();
      const args = ['export'];
      if (force) args.push('-f');
      args.push(name);

      const result = await executor.zpool(...args);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'POOL_EXPORT_FAILED', `Failed to export pool: ${result.stderr}`);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Pool "${name}" exported`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
