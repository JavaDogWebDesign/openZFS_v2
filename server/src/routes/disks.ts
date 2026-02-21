/**
 * Disk discovery and SMART health routes.
 *
 * GET /api/disks      - List all block devices
 * GET /api/disks/:id  - Get detail + SMART data for a specific disk
 */

import { Router } from 'express';
import type { ApiResponse, Disk, SMARTData } from '@zfs-manager/shared';
import { requireAuth } from '../middleware/auth.js';
import { listDisks, getDiskDetail, getSmartData, getByIdPath } from '../services/diskService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface DiskDetailResponse {
  disk: Disk;
  smart: SMARTData;
}

// ---------------------------------------------------------------------------
// GET / - List all disks
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const disks = await listDisks();

    // Enrich with by-id paths
    for (const disk of disks) {
      if (!disk.byIdPath) {
        disk.byIdPath = await getByIdPath(disk.name);
      }
    }

    const response: ApiResponse<Disk[]> = { success: true, data: disks };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id - Get disk detail with SMART data
// ---------------------------------------------------------------------------

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const diskName = req.params.id;
    const disk = await getDiskDetail(diskName);

    if (!disk) {
      throw new AppError(404, 'DISK_NOT_FOUND', `Disk "${diskName}" not found`);
    }

    // Fetch SMART data
    const smart = await getSmartData(disk.path);

    // Enrich disk with temperature from SMART
    if (smart.temperature !== undefined) {
      disk.temperature = smart.temperature;
    }

    // Enrich with by-id path
    if (!disk.byIdPath) {
      disk.byIdPath = await getByIdPath(disk.name);
    }

    const data: DiskDetailResponse = { disk, smart };
    const response: ApiResponse<DiskDetailResponse> = { success: true, data };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
