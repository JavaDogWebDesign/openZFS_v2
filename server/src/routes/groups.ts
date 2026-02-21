/**
 * Group management routes.
 *
 * GET    /api/groups                          - List all groups
 * POST   /api/groups                          - Create a group
 * GET    /api/groups/:name                    - Get a group
 * PUT    /api/groups/:name                    - Update a group (reserved for future use)
 * DELETE /api/groups/:name                    - Delete a group
 * POST   /api/groups/:name/members            - Add a member
 * DELETE /api/groups/:name/members/:username   - Remove a member
 */

import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, SystemGroup } from '@zfs-manager/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import * as groupService from '../services/groupService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(32).regex(/^[a-z_][a-z0-9_-]*$/, 'Invalid group name format'),
  gid: z.number().int().positive().optional(),
});

const AddMemberSchema = z.object({
  username: z.string().min(1, 'Username is required'),
});

// ---------------------------------------------------------------------------
// GET / - List groups
// ---------------------------------------------------------------------------

router.get('/', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const groups = await groupService.listGroups();
    const response: ApiResponse<SystemGroup[]> = { success: true, data: groups };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / - Create group
// ---------------------------------------------------------------------------

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(CreateGroupSchema),
  auditLog('group.create', {
    target: (req) => req.body.name,
  }),
  async (req, res, next) => {
    try {
      const { name, gid } = req.body as z.infer<typeof CreateGroupSchema>;
      const group = await groupService.createGroup({ name, gid });

      const response: ApiResponse<SystemGroup> = {
        success: true,
        data: group,
        message: `Group "${name}" created successfully`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:name - Get group
// ---------------------------------------------------------------------------

router.get('/:name', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const group = await groupService.getGroup(req.params.name);

    if (!group) {
      throw new AppError(404, 'GROUP_NOT_FOUND', `Group "${req.params.name}" not found`);
    }

    const response: ApiResponse<SystemGroup> = { success: true, data: group };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:name - Update group (placeholder for future metadata)
// ---------------------------------------------------------------------------

router.put(
  '/:name',
  requireAuth,
  requireAdmin,
  auditLog('group.modify', {
    target: (req) => req.params.name,
  }),
  async (req, res, next) => {
    try {
      // Currently groups don't have updatable properties beyond membership
      // (which is managed via the /members sub-routes).
      // This endpoint exists for future extension (e.g. description, quotas).
      const group = await groupService.getGroup(req.params.name);

      if (!group) {
        throw new AppError(404, 'GROUP_NOT_FOUND', `Group "${req.params.name}" not found`);
      }

      const response: ApiResponse<SystemGroup> = {
        success: true,
        data: group,
        message: 'No updatable properties changed',
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:name - Delete group
// ---------------------------------------------------------------------------

router.delete(
  '/:name',
  requireAuth,
  requireAdmin,
  auditLog('group.delete', {
    target: (req) => req.params.name,
  }),
  async (req, res, next) => {
    try {
      await groupService.deleteGroup(req.params.name);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `Group "${req.params.name}" deleted`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:name/members - Add member
// ---------------------------------------------------------------------------

router.post(
  '/:name/members',
  requireAuth,
  requireAdmin,
  validate(AddMemberSchema),
  auditLog('group.modify', {
    target: (req) => req.params.name,
    details: (req) => ({ action: 'add-member', username: req.body.username }),
  }),
  async (req, res, next) => {
    try {
      const { username } = req.body as z.infer<typeof AddMemberSchema>;
      const group = await groupService.addMember(req.params.name, username);

      const response: ApiResponse<SystemGroup> = {
        success: true,
        data: group,
        message: `User "${username}" added to group "${req.params.name}"`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:name/members/:username - Remove member
// ---------------------------------------------------------------------------

router.delete(
  '/:name/members/:username',
  requireAuth,
  requireAdmin,
  auditLog('group.modify', {
    target: (req) => req.params.name,
    details: (req) => ({ action: 'remove-member', username: req.params.username }),
  }),
  async (req, res, next) => {
    try {
      const group = await groupService.removeMember(req.params.name, req.params.username);

      const response: ApiResponse<SystemGroup> = {
        success: true,
        data: group,
        message: `User "${req.params.username}" removed from group "${req.params.name}"`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
