/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * On every safe (GET / HEAD / OPTIONS) request that has an authenticated
 * session, the server sets a readable `csrf-token` cookie.  The client-side
 * fetch wrapper reads that cookie and sends it back as the `X-CSRF-Token`
 * header on every mutating request.
 *
 * On mutating methods (POST, PUT, PATCH, DELETE) the middleware verifies
 * that the header value matches the cookie value.
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { config } from '../config/index.js';

/** Name of the cookie the server sets (readable by JS) */
const CSRF_COOKIE = 'csrf-token';

/** Name of the header the client must send back (Express lowercases headers) */
const CSRF_HEADER = 'x-csrf-token';

/** HTTP methods that are considered "safe" (no side effects) */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate a random CSRF token.
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF middleware (double-submit cookie pattern).
 *
 * Usage: mount *after* cookie-parser and *before* route handlers.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    // On safe requests, issue (or refresh) the CSRF cookie so the client
    // always has a token available for the next mutating request.
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // must be readable by client JS
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/',
    });
    next();
    return;
  }

  // Mutating request -- validate the token
  const cookieToken: string | undefined = req.cookies?.[CSRF_COOKIE];
  const headerToken: string | undefined = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken) {
    console.log(`[csrf] BLOCKED ${req.method} ${req.originalUrl} - missing token (cookie=${!!cookieToken}, header=${!!headerToken})`);
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_MISSING', message: 'CSRF token missing' },
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    console.log(`[csrf] BLOCKED ${req.method} ${req.originalUrl} - token mismatch`);
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_INVALID', message: 'CSRF token mismatch' },
    });
    return;
  }

  next();
}
