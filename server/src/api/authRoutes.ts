import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Ctx } from '../context.js';
import { ApiException, validation } from '../lib/errors.js';
import { claimLegacyToken, writeUserToken } from '../auth/people.js';
import { setSessionCookie } from '../auth/middleware.js';
import type { OAuthBackend } from '../auth/oauth.js';
import { SESSION_COOKIE } from '../auth/sessions.js';
import type { AuthEnv } from '../auth/middleware.js';

const STATE_COOKIE = 'cal_oauth_state';

/** The OAuth backend in use: real Google with PROVIDER=google, the test double in TEST_MODE, else none (404). */
async function backend(ctx: Ctx): Promise<OAuthBackend> {
  if (ctx.config.provider === 'google') {
    // Lazy: the Google client libraries are only loaded when PROVIDER=google.
    const { GoogleOAuth } = await import('../providers/google/auth.js');
    return (ctx.auth.google ??= new GoogleOAuth(ctx.config));
  }
  if (ctx.auth.fake) return ctx.auth.fake;
  throw new ApiException('NOT_FOUND', 404, 'Not found');
}

/** Sign-in routes (API.md "Sign-in"): one OAuth round trip signs in and connects the person's Google calendar. */
export function authRoutes(ctx: Ctx): Hono<AuthEnv> {
  const r = new Hono<AuthEnv>();

  r.get('/auth/google/start', async (c) => {
    const oauth = await backend(ctx);
    const state = ctx.auth.states.create();
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, sameSite: 'Lax', path: '/api/auth', maxAge: 600, secure: ctx.config.publicUrl?.startsWith('https://') ?? false });
    return c.redirect(oauth.authUrl(state), 302);
  });

  r.get('/auth/google/callback', async (c) => {
    const oauth = await backend(ctx);
    const code = c.req.query('code');
    const state = c.req.query('state');
    // the state must be one we issued AND belong to this browser (cookie), else it is a forged or replayed callback
    if (!code || !state || !ctx.auth.states.consume(state) || getCookie(c, STATE_COOKIE) !== state) throw validation('Invalid state');
    deleteCookie(c, STATE_COOKIE, { path: '/api/auth' });
    const who = await oauth.exchange(code);
    // not on the list (or unverified): keep nothing, not even the token
    if (!who.emailVerified || !ctx.auth.allows(who.email)) return c.redirect('/signin?error=private', 302);
    const claimed = claimLegacyToken(ctx.config.dataDir, who.sub);
    const refresh = who.refreshToken ?? claimed;
    if (!refresh) throw validation('Google did not return a refresh token (revoke access and retry)');
    if (ctx.config.provider === 'google') {
      (await import('../providers/google/auth.js')).storeUserToken(ctx.config, who.sub, refresh);
    } else {
      writeUserToken(ctx.config.dataDir, who.sub, refresh);
    }
    setSessionCookie(ctx, c, ctx.auth.sessions.create({ sub: who.sub, email: who.email.toLowerCase(), ...(who.name ? { name: who.name } : {}) }));
    return c.redirect('/', 302);
  });

  // With auth off nobody signs in: answer 200 with nulls so the client can tell "off" from "signed out" (401).
  r.get('/auth/me', (c) => {
    if (!ctx.auth.on) return c.json({ email: null, name: null });
    const p = c.get('person');
    if (!p) throw new ApiException('UNAUTHENTICATED', 401, 'Sign in required');
    return c.json({ email: p.email, name: p.name ?? p.email });
  });

  r.post('/auth/signout', (c) => {
    ctx.auth.sessions.delete(getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  return r;
}
