/**
 * Authentication middleware and session helpers.
 *
 * Sessions are stored in the SQLite `sessions` table and referenced by an
 * opaque token kept in an httpOnly cookie named `session_token`.
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { SessionInfo } from '@zfs-manager/shared';
import { getDb } from '../db/connection.js';
import { config } from '../config/index.js';

// ---------------------------------------------------------------------------
// Extend Express Request to carry session data
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth middleware when the session is valid */
      user?: SessionInfo;
      /** The raw session token (for destroySession) */
      sessionToken?: string;
    }
  }
}

/** Name of the cookie that stores the session token */
const SESSION_COOKIE = 'session_token';

// ---------------------------------------------------------------------------
// Session CRUD helpers
// ---------------------------------------------------------------------------

export interface CreateSessionParams {
  username: string;
  uid: number;
  gid: number;
  groups: string[];
  isAdmin: boolean;
  ip: string;
  userAgent: string;
}

/**
 * Create a new session row in the database and return the generated token.
 */
export function createSession(params: CreateSessionParams): string {
  const db = getDb();
  const token = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1000);

  db.prepare(`
    INSERT INTO sessions (id, username, uid, gid, groups_json, is_admin, ip, user_agent, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    token,
    params.username,
    params.uid,
    params.gid,
    JSON.stringify(params.groups),
    params.isAdmin ? 1 : 0,
    params.ip,
    params.userAgent,
    now.toISOString(),
    expiresAt.toISOString(),
  );

  return token;
}

/**
 * Destroy (delete) a session by token.
 */
export function destroySession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

/**
 * Remove all sessions that have passed their expiration time.
 */
export function purgeExpiredSessions(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  return result.changes;
}

/**
 * Look up a session by token and return the SessionInfo, or null if
 * the token is invalid / expired.
 */
export function lookupSession(token: string): SessionInfo | null {
  const db = getDb();

  const row = db.prepare(`
    SELECT username, uid, gid, groups_json, is_admin, created_at
    FROM sessions
    WHERE id = ? AND expires_at > datetime('now')
  `).get(token) as
    | { username: string; uid: number; gid: number; groups_json: string; is_admin: number; created_at: string }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    username: row.username,
    uid: row.uid,
    gid: row.gid,
    groups: JSON.parse(row.groups_json) as string[],
    isAdmin: row.is_admin === 1,
    loginTime: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/**
 * Middleware: require a valid session.
 *
 * Reads the session token from the `session_token` cookie, looks it up in the
 * database, and attaches the user info to `req.user`.  Returns 401 if the
 * session is missing or expired.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[SESSION_COOKIE];

  if (!token) {
    console.log(`[auth] REJECTED ${req.method} ${req.originalUrl} - no session cookie`);
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const session = lookupSession(token);

  if (!session) {
    console.log(`[auth] REJECTED ${req.method} ${req.originalUrl} - session expired/invalid`);
    res.clearCookie(SESSION_COOKIE);
    res.status(401).json({
      success: false,
      error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' },
    });
    return;
  }

  console.log(`[auth] OK ${req.method} ${req.originalUrl} - user=${session.username} admin=${session.isAdmin}`);
  req.user = session;
  req.sessionToken = token;
  next();
}

/**
 * Middleware: require the authenticated user to be an administrator.
 * Must be used AFTER requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    console.log(`[auth] FORBIDDEN ${req.method} ${req.originalUrl} - user=${req.user?.username} is not admin`);
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Administrator privileges required' },
    });
    return;
  }

  next();
}

/**
 * Helper: set the session cookie on the response.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: config.sessionTtlSeconds * 1000,
    path: '/',
  });
}

/**
 * Helper: clear the session cookie on the response.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
  });
}
