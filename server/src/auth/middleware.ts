import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { Ctx } from '../context.js';
import { ApiException } from '../lib/errors.js';
import { SESSION_COOKIE, SESSION_TTL_MS, type Session } from './sessions.js';

/** Request variables set by `sessionMiddleware`. */
export type AuthEnv = { Variables: { person?: Session } };

/** Routes that answer without a session while auth is on (`/auth/me` answers 401 itself). */
const PUBLIC = new Set(['/api/health', '/api/auth/google/start', '/api/auth/google/callback', '/api/auth/app-exchange', '/api/auth/app-open', '/api/auth/me']);

/** Writes the session cookie (also used again when a session is extended, so the cookie slides with it). */
export function setSessionCookie(ctx: Ctx, c: Context, id: string): void {
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_MS / 1000, secure: ctx.config.publicUrl?.startsWith('https://') ?? false,
  });
}

/**
 * Resolves the session cookie to `c.get('person')` and, while auth is on, refuses every non-public /api route
 * without a valid session (401 UNAUTHENTICATED).
 */
export function sessionMiddleware(ctx: Ctx): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    if (!ctx.auth.on) return next();
    const id = getCookie(c, SESSION_COOKIE);
    let hit = ctx.auth.sessions.get(id);
    // a person taken off ALLOWED_EMAILS loses every session at their next request, not after 90 days
    if (hit && !ctx.auth.allows(hit.session.email)) {
      ctx.auth.sessions.deleteSub(hit.session.sub);
      ctx.forgetPerson(hit.session.sub);
      hit = null;
    }
    if (hit) {
      c.set('person', hit.session);
      if (hit.extended) setSessionCookie(ctx, c, id!);
    }
    const path = c.req.path;
    // the TEST_MODE endpoints (incl. the fake consent screen) stand in for Google and the test harness
    const open = PUBLIC.has(path) || (ctx.config.testMode && path.startsWith('/api/__test/'));
    if (!hit && !open) throw new ApiException('UNAUTHENTICATED', 401, 'Sign in required');
    return next();
  };
}
