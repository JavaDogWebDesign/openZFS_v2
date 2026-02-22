/**
 * User management routes.
 *
 * GET    /api/users                          - List all users
 * POST   /api/users                          - Create a user
 * GET    /api/users/:username                - Get a user
 * PUT    /api/users/:username                - Modify a user
 * DELETE /api/users/:username                - Delete a user
 * POST   /api/users/:username/smb-password   - Set SMB password
 * GET    /api/users/:username/shares         - Get user's share assignments
 * POST   /api/users/:username/shares         - Set user's share assignments
 */

import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, SystemUser } from '@zfs-manager/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import * as userService from '../services/userService.js';
import * as shareService from '../services/shareService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateUserSchema = z.object({
  username: z.string().min(1).max(32).regex(/^[a-z_][a-z0-9_-]*$/, 'Invalid username format'),
  fullName: z.string().max(256).optional(),
  shell: z.string().optional().default('/bin/bash'),
  homeDir: z.string().optional(),
  groups: z.array(z.string()).optional(),
  password: z.string().min(1, 'Password is required'),
  createHome: z.boolean().optional().default(true),
});

const ModifyUserSchema = z.object({
  fullName: z.string().max(256).optional(),
  shell: z.string().optional(),
  homeDir: z.string().optional(),
  groups: z.array(z.string()).optional(),
  locked: z.boolean().optional(),
  password: z.string().min(1).optional(),
});

const SetSmbPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// ---------------------------------------------------------------------------
// GET / - List users
// ---------------------------------------------------------------------------

router.get('/', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const users = await userService.listUsers();
    const response: ApiResponse<SystemUser[]> = { success: true, data: users };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / - Create user
// ---------------------------------------------------------------------------

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(CreateUserSchema),
  auditLog('user.create', {
    target: (req) => req.body.username,
  }),
  async (req, res, next) => {
    try {
      const { username, fullName, shell, homeDir, groups, password, createHome } = req.body as z.infer<typeof CreateUserSchema>;

      const user = await userService.createUser({
        username,
        fullName,
        shell,
        homeDir,
        groups,
        createHome,
      });

      // Set password
      await userService.changePassword(username, password);

      const response: ApiResponse<SystemUser> = {
        success: true,
        data: user,
        message: `User "${username}" created successfully`,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:username - Get user
// ---------------------------------------------------------------------------

router.get('/:username', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const user = await userService.getUser(req.params.username);

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `User "${req.params.username}" not found`);
    }

    const response: ApiResponse<SystemUser> = { success: true, data: user };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:username - Modify user
// ---------------------------------------------------------------------------

router.put(
  '/:username',
  requireAuth,
  requireAdmin,
  validate(ModifyUserSchema),
  auditLog('user.modify', {
    target: (req) => req.params.username,
    details: (req) => req.body,
  }),
  async (req, res, next) => {
    try {
      const { password, ...params } = req.body as z.infer<typeof ModifyUserSchema>;
      const user = await userService.modifyUser(req.params.username, params);

      // Handle password change if requested
      if (password) {
        await userService.changePassword(req.params.username, password);
      }

      const response: ApiResponse<SystemUser> = {
        success: true,
        data: user,
        message: `User "${req.params.username}" updated`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:username - Delete user
// ---------------------------------------------------------------------------

router.delete(
  '/:username',
  requireAuth,
  requireAdmin,
  auditLog('user.delete', {
    target: (req) => req.params.username,
  }),
  async (req, res, next) => {
    try {
      const removeHome = req.query.removeHome === 'true';
      await userService.deleteUser(req.params.username, removeHome);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `User "${req.params.username}" deleted`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:username/smb-password - Set SMB password
// ---------------------------------------------------------------------------

router.post(
  '/:username/smb-password',
  requireAuth,
  requireAdmin,
  validate(SetSmbPasswordSchema),
  auditLog('user.modify', {
    target: (req) => req.params.username,
    details: () => ({ action: 'smb-password-set' }),
  }),
  async (req, res, next) => {
    try {
      const { password } = req.body as z.infer<typeof SetSmbPasswordSchema>;
      await userService.setSmbPassword(req.params.username, password);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: `SMB password set for "${req.params.username}"`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:username/shares - Get user's share assignments
// ---------------------------------------------------------------------------

router.get('/:username/shares', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const shares = await shareService.getUserShareAssignments(req.params.username);
    const response: ApiResponse<string[]> = { success: true, data: shares };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:username/shares - Set user's share assignments
// ---------------------------------------------------------------------------

const SetShareAssignmentsSchema = z.object({
  shares: z.array(z.string()),
});

router.post(
  '/:username/shares',
  requireAuth,
  requireAdmin,
  validate(SetShareAssignmentsSchema),
  auditLog('user.modify', {
    target: (req) => req.params.username,
    details: (req) => ({ action: 'share-assignment', shares: req.body.shares }),
  }),
  async (req, res, next) => {
    try {
      const { shares } = req.body as z.infer<typeof SetShareAssignmentsSchema>;
      await shareService.assignUserToShares(req.params.username, shares);

      const response: ApiResponse<string[]> = {
        success: true,
        data: shares,
        message: `Share assignments updated for "${req.params.username}"`,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
