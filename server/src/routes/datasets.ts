/**
 * Dataset management routes.
 *
 * GET    /api/datasets       - List datasets (optionally filtered by pool query param)
 * POST   /api/datasets       - Create a new dataset
 * GET    /api/datasets/:id   - Get a single dataset (id is URL-encoded path)
 * PATCH  /api/datasets/:id   - Set properties on a dataset
 * DELETE /api/datasets/:id   - Destroy a dataset
 */

import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, Dataset } from '@zfs-manager/shared';
import { validate, validateQuery } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { getExecutor } from '../services/zfsExecutor.js';
import { parseDatasetList } from '../services/zfsParser.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ListDatasetsQuery = z.object({
  pool: z.string().optional(),
});

const CreateDatasetSchema = z.object({
  name: z.string().min(1, 'Dataset name is required'),
  properties: z.record(z.string()).optional(),
});

const SetPropertiesSchema = z.object({
  properties: z.record(z.string(), z.string()).refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one property is required',
  }),
});

// ---------------------------------------------------------------------------
// GET / - List datasets
// ---------------------------------------------------------------------------

router.get(
  '/',
  requireAuth,
  validateQuery(ListDatasetsQuery),
  async (req, res, next) => {
    try {
      const pool = (req as unknown as { validatedQuery: z.infer<typeof ListDatasetsQuery> }).validatedQuery?.pool;
      const executor = getExecutor();
      const result = await executor.listDatasets(pool);

      if (result.exitCode !== 0 && !result.stdout.trim()) {
        const response: ApiResponse<Dataset[]> = { success: true, data: [] };
        res.json(response);
        return;
      }

      const datasets = parseDatasetList(result.stdout);
      const response: ApiResponse<Dataset[]> = { success: true, data: datasets };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST / - Create dataset
// ---------------------------------------------------------------------------

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(CreateDatasetSchema),
  auditLog('dataset.create', {
    target: (req) => req.body.name,
    details: (req) => ({ properties: req.body.properties }),
  }),
  async (req, res, next) => {
    try {
      const { name, properties } = req.body as z.infer<typeof CreateDatasetSchema>;

      const executor = getExecutor();
      const result = await executor.createDataset(name, properties);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'DATASET_CREATE_FAILED', `Failed to create dataset: ${result.stderr}`);
      }

      // Fetch the created dataset
      const listResult = await executor.listDatasets();
      const datasets = parseDatasetList(listResult.stdout);
      const dataset = datasets.find((d) => d.name === name);

      const response: ApiResponse<Dataset> = {
        success: true,
        data: dataset!,
        message: `Dataset "${name}" created successfully`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id - Get single dataset
// ---------------------------------------------------------------------------

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const datasetName = decodeURIComponent(req.params.id);
    const executor = getExecutor();

    const result = await executor.listDatasets();
    const datasets = parseDatasetList(result.stdout);
    const dataset = datasets.find((d) => d.name === datasetName);

    if (!dataset) {
      throw new AppError(404, 'DATASET_NOT_FOUND', `Dataset "${datasetName}" not found`);
    }

    const response: ApiResponse<Dataset> = { success: true, data: dataset };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id - Set properties
// ---------------------------------------------------------------------------

router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(SetPropertiesSchema),
  auditLog('dataset.set', {
    target: (req) => decodeURIComponent(req.params.id),
    details: (req) => ({ properties: req.body.properties }),
  }),
  async (req, res, next) => {
    try {
      const datasetName = decodeURIComponent(req.params.id);
      const { properties } = req.body as z.infer<typeof SetPropertiesSchema>;

      const executor = getExecutor();

      // Apply each property
      for (const [key, value] of Object.entries(properties as Record<string, string>)) {
        const result = await executor.setProperty(datasetName, key, value as string);
        if (result.exitCode !== 0) {
          throw new AppError(400, 'DATASET_SET_FAILED', `Failed to set ${key}=${value}: ${result.stderr}`);
        }
      }

      // Fetch updated dataset
      const listResult = await executor.listDatasets();
      const datasets = parseDatasetList(listResult.stdout);
      const dataset = datasets.find((d) => d.name === datasetName);

      if (!dataset) {
        throw new AppError(404, 'DATASET_NOT_FOUND', `Dataset "${datasetName}" not found after update`);
      }

      const response: ApiResponse<Dataset> = {
        success: true,
        data: dataset,
        message: 'Properties updated successfully',
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:id - Destroy dataset
// ---------------------------------------------------------------------------

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  auditLog('dataset.destroy', {
    target: (req) => decodeURIComponent(req.params.id),
  }),
  async (req, res, next) => {
    try {
      const datasetName = decodeURIComponent(req.params.id);
      const recursive = req.query.recursive === 'true';

      const executor = getExecutor();
      const result = await executor.destroy(datasetName, recursive);

      if (result.exitCode !== 0) {
        throw new AppError(400, 'DATASET_DESTROY_FAILED', `Failed to destroy dataset: ${result.stderr}`);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Dataset "${datasetName}" destroyed`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
