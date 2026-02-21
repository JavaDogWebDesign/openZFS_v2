/**
 * System information routes.
 *
 * GET /api/system/info    - System overview (hostname, memory, CPU, ZFS version)
 * GET /api/system/version - Application version
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiResponse, SystemInfo } from '@zfs-manager/shared';
import { requireAuth } from '../middleware/auth.js';
import { getSystemInfo } from '../services/monitoringService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VersionInfo {
  /** Application version from package.json */
  version: string;
  /** Application name */
  name: string;
  /** Node.js runtime version */
  nodeVersion: string;
  /** Build timestamp (set during CI/CD, otherwise "development") */
  buildTime: string;
}

// ---------------------------------------------------------------------------
// GET /info - System information
// ---------------------------------------------------------------------------

router.get('/info', requireAuth, async (_req, res, next) => {
  try {
    const info = await getSystemInfo();
    const response: ApiResponse<SystemInfo> = { success: true, data: info };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /version - Application version
// ---------------------------------------------------------------------------

router.get('/version', requireAuth, (_req, res, next) => {
  try {
    // Read version from the server's package.json
    let version = '1.0.0';
    let name = '@zfs-manager/server';

    try {
      const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
      const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent) as { version?: string; name?: string };
      version = pkg.version ?? version;
      name = pkg.name ?? name;
    } catch {
      // Use defaults if package.json is not readable
    }

    const versionInfo: VersionInfo = {
      version,
      name,
      nodeVersion: process.version,
      buildTime: process.env.BUILD_TIME ?? 'development',
    };

    const response: ApiResponse<VersionInfo> = { success: true, data: versionInfo };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
