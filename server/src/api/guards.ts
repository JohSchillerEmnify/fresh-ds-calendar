/**
 * Request guards of every `/api/*` call: the Origin check against cross-site
 * requests (CSRF), the JSON-only content type, and the body size limit.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppConfig } from '../config.js';
import { ApiException } from '../lib/errors.js';

/** Largest request body of any `/api/*` call, in bytes. */
export const MAX_BODY_BYTES = 256 * 1024;
/** Largest body of `POST /api/themes` (a 200 KB theme plus its own pictures), in bytes. */
export const MAX_THEME_BODY_BYTES = 400 * 1024;

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Whether the request's `Origin` may write: absent (native client), an allowed origin, or this server's own host when no public URL is set. */
function originAllowed(config: AppConfig, c: Context): boolean {
  const origin = c.req.header('origin');
  if (origin === undefined) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  // without a configured public URL (local, test and home server runs) the page's own origin is the only one there is
  if (config.publicUrl !== null) return false;
  try {
    return new URL(origin).host === new URL(c.req.url).host;
  } catch {
    return false;
  }
}

/** True when the body (if any) is declared as JSON; a bodyless request needs no type. */
function contentTypeOk(c: Context): boolean {
  const type = c.req.header('content-type');
  if (type !== undefined) return /^application\/json\s*(;|$)/i.test(type);
  const length = c.req.header('content-length');
  return !c.req.header('transfer-encoding') && (length === undefined || length === '0');
}

/**
 * Builds the guard middleware: non-GET requests need an allowed Origin (or none) and a JSON content type, and their
 * body must fit {@link MAX_BODY_BYTES} ({@link MAX_THEME_BODY_BYTES} for themes).
 */
export function requestGuards(config: AppConfig): MiddlewareHandler {
  const tooLarge = (c: Context) => c.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large' } }, 413);
  const normal = bodyLimit({ maxSize: MAX_BODY_BYTES, onError: tooLarge });
  const theme = bodyLimit({ maxSize: MAX_THEME_BODY_BYTES, onError: tooLarge });
  return async (c, next) => {
    if (READ_ONLY.has(c.req.method)) return next();
    // a cross-site page can make the browser send the cookie, but cannot hide where the request came from
    if (!originAllowed(config, c)) throw new ApiException('FORBIDDEN', 403, 'Request from an unknown origin');
    // a "simple" cross-site form post could carry JSON text as text/plain; only declared JSON is read
    if (!contentTypeOk(c)) throw new ApiException('UNSUPPORTED_MEDIA_TYPE', 415, 'Request body must be application/json');
    return (c.req.path === '/api/themes' ? theme : normal)(c, next);
  };
}
