/**
 * HTTP request/response logger middleware.
 *
 * Logs every incoming request and its response with timing, status,
 * body summaries, and auth state.
 */

import type { Request, Response, NextFunction } from 'express';

const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'smbPassword']);

/**
 * Redact sensitive fields from an object (shallow).
 */
function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    redacted[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
  }
  return redacted;
}

/**
 * Truncate long strings for log output.
 */
function summarize(obj: unknown, maxLen = 500): string {
  const str = JSON.stringify(obj);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

/**
 * Express middleware that logs every request and response.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  // Log the incoming request
  const logParts = [`[req] ${method} ${originalUrl}`];

  if (req.body && Object.keys(req.body as object).length > 0) {
    logParts.push(`body=${summarize(redactBody(req.body))}`);
  }

  if (req.cookies?.session_token) {
    logParts.push('auth=cookie-present');
  } else {
    logParts.push('auth=none');
  }

  console.log(logParts.join(' | '));

  // Capture the response by wrapping res.json
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const resParts = [
      `[res] ${method} ${originalUrl}`,
      `status=${status}`,
      `${duration}ms`,
    ];

    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if (b.success === false) {
        resParts.push(`error=${summarize(b.error)}`);
      } else {
        resParts.push('success=true');
      }
    }

    console.log(resParts.join(' | '));
    return originalJson(body);
  };

  next();
}
