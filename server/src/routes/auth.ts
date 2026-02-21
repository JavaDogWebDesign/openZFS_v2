/**
 * Authentication routes.
 *
 * POST /api/auth/login   - Authenticate with username/password, create session
 * POST /api/auth/logout  - Destroy current session
 * GET  /api/auth/me      - Get current session info
 */

import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, SessionInfo } from '@zfs-manager/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, createSession, destroySession, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { auditLog } from '../middleware/audit.js';
import { authenticate } from '../services/pamService.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required'),
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

router.post(
  '/login',
  authLimiter,
  validate(LoginSchema),
  auditLog('login', {
    target: (req) => req.body.username,
    details: (req) => ({ ip: req.ip }),
  }),
  async (req, res, next) => {
    try {
      const { username, password } = req.body as z.infer<typeof LoginSchema>;

      const authResult = await authenticate(username, password);

      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: authResult.error ?? 'Invalid credentials',
          },
        });
        return;
      }

      // Create a session
      const token = createSession({
        username,
        uid: authResult.uid,
        gid: authResult.gid,
        groups: authResult.groups,
        isAdmin: authResult.isAdmin,
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      });

      setSessionCookie(res, token);

      const session: SessionInfo = {
        username,
        uid: authResult.uid,
        gid: authResult.gid,
        groups: authResult.groups,
        isAdmin: authResult.isAdmin,
        loginTime: new Date().toISOString(),
      };

      const response: ApiResponse<SessionInfo> = {
        success: true,
        data: session,
        message: 'Login successful',
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

router.post(
  '/logout',
  requireAuth,
  auditLog('logout', {
    target: (req) => req.user?.username ?? 'unknown',
  }),
  (req, res, next) => {
    try {
      if (req.sessionToken) {
        destroySession(req.sessionToken);
      }

      clearSessionCookie(res);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Logged out successfully',
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

router.get('/me', requireAuth, (req, res, next) => {
  try {
    const response: ApiResponse<SessionInfo> = {
      success: true,
      data: req.user!,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
