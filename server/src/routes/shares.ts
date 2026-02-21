/**
 * File sharing routes for SMB and NFS.
 *
 * SMB:
 *   GET    /api/shares/smb        - List SMB shares
 *   POST   /api/shares/smb        - Create SMB share
 *   PUT    /api/shares/smb/:name  - Update SMB share
 *   DELETE /api/shares/smb/:name  - Delete SMB share
 *
 * NFS:
 *   GET    /api/shares/nfs        - List NFS exports
 *   POST   /api/shares/nfs        - Create NFS export
 *   PUT    /api/shares/nfs/:id    - Update NFS export
 *   DELETE /api/shares/nfs/:id    - Delete NFS export
 */

import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, SMBShare, NFSShare } from '@zfs-manager/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import * as shareService from '../services/shareService.js';

const router = Router();

// ---------------------------------------------------------------------------
// SMB Schemas
// ---------------------------------------------------------------------------

const CreateSmbShareSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid share name'),
  path: z.string().min(1, 'Share path is required'),
  comment: z.string().optional(),
  browseable: z.boolean().optional().default(true),
  readonly: z.boolean().optional().default(false),
  guestOk: z.boolean().optional().default(false),
  validUsers: z.array(z.string()).optional(),
  invalidUsers: z.array(z.string()).optional(),
  writeList: z.array(z.string()).optional(),
  createMask: z.string().optional(),
  directoryMask: z.string().optional(),
  forceUser: z.string().optional(),
  forceGroup: z.string().optional(),
  vfsObjects: z.array(z.string()).optional(),
  recycleRepository: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

const UpdateSmbShareSchema = CreateSmbShareSchema.partial().omit({ name: true });

// ---------------------------------------------------------------------------
// NFS Schemas
// ---------------------------------------------------------------------------

const NfsAccessRuleSchema = z.object({
  host: z.string().min(1),
  options: z.array(z.string()).min(1),
});

const CreateNfsExportSchema = z.object({
  path: z.string().min(1, 'Export path is required'),
  enabled: z.boolean().optional().default(true),
  rules: z.array(NfsAccessRuleSchema).min(1, 'At least one access rule is required'),
  comment: z.string().optional(),
});

const UpdateNfsExportSchema = CreateNfsExportSchema.partial().omit({ path: true });

// ============================================================================
// SMB Routes
// ============================================================================

// GET /smb - List SMB shares
router.get('/smb', requireAuth, async (_req, res, next) => {
  try {
    const shares = await shareService.listSmbShares();
    const response: ApiResponse<SMBShare[]> = { success: true, data: shares };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /smb - Create SMB share
router.post(
  '/smb',
  requireAuth,
  requireAdmin,
  validate(CreateSmbShareSchema),
  auditLog('share.create', {
    target: (req) => `smb:${req.body.name}`,
    details: (req) => ({ type: 'smb', path: req.body.path }),
  }),
  async (req, res, next) => {
    try {
      const shareData = req.body as z.infer<typeof CreateSmbShareSchema>;
      const share = await shareService.createSmbShare(shareData as SMBShare);

      const response: ApiResponse<SMBShare> = {
        success: true,
        data: share,
        message: `SMB share "${share.name}" created`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /smb/:name - Update SMB share
router.put(
  '/smb/:name',
  requireAuth,
  requireAdmin,
  validate(UpdateSmbShareSchema),
  auditLog('share.modify', {
    target: (req) => `smb:${req.params.name}`,
  }),
  async (req, res, next) => {
    try {
      const updates = req.body as z.infer<typeof UpdateSmbShareSchema>;
      const share = await shareService.updateSmbShare(req.params.name, updates);

      const response: ApiResponse<SMBShare> = {
        success: true,
        data: share,
        message: `SMB share "${req.params.name}" updated`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /smb/:name - Delete SMB share
router.delete(
  '/smb/:name',
  requireAuth,
  requireAdmin,
  auditLog('share.delete', {
    target: (req) => `smb:${req.params.name}`,
  }),
  async (req, res, next) => {
    try {
      await shareService.deleteSmbShare(req.params.name);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `SMB share "${req.params.name}" deleted`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// NFS Routes
// ============================================================================

// GET /nfs - List NFS exports
router.get('/nfs', requireAuth, async (_req, res, next) => {
  try {
    const exports = await shareService.listNfsExports();
    const response: ApiResponse<NFSShare[]> = { success: true, data: exports };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /nfs - Create NFS export
router.post(
  '/nfs',
  requireAuth,
  requireAdmin,
  validate(CreateNfsExportSchema),
  auditLog('share.create', {
    target: (req) => `nfs:${req.body.path}`,
    details: (req) => ({ type: 'nfs', rules: req.body.rules }),
  }),
  async (req, res, next) => {
    try {
      const exportData = req.body as z.infer<typeof CreateNfsExportSchema>;
      const nfsExport = await shareService.createNfsExport(exportData as NFSShare);

      const response: ApiResponse<NFSShare> = {
        success: true,
        data: nfsExport,
        message: `NFS export for "${nfsExport.path}" created`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /nfs/:id - Update NFS export (id is URL-encoded path)
router.put(
  '/nfs/:id',
  requireAuth,
  requireAdmin,
  validate(UpdateNfsExportSchema),
  auditLog('share.modify', {
    target: (req) => `nfs:${decodeURIComponent(req.params.id)}`,
  }),
  async (req, res, next) => {
    try {
      const exportPath = decodeURIComponent(req.params.id);
      const updates = req.body as z.infer<typeof UpdateNfsExportSchema>;
      const nfsExport = await shareService.updateNfsExport(exportPath, updates);

      const response: ApiResponse<NFSShare> = {
        success: true,
        data: nfsExport,
        message: `NFS export for "${exportPath}" updated`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /nfs/:id - Delete NFS export (id is URL-encoded path)
router.delete(
  '/nfs/:id',
  requireAuth,
  requireAdmin,
  auditLog('share.delete', {
    target: (req) => `nfs:${decodeURIComponent(req.params.id)}`,
  }),
  async (req, res, next) => {
    try {
      const exportPath = decodeURIComponent(req.params.id);
      await shareService.deleteNfsExport(exportPath);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `NFS export for "${exportPath}" deleted`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
