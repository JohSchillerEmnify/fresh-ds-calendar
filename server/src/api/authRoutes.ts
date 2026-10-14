import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Ctx } from '../context.js';
import { ApiException, validation } from '../lib/errors.js';
import { claimLegacyToken, hasCalendarScope, writeUserToken } from '../auth/people.js';
import { setSessionCookie } from '../auth/middleware.js';
import type { OAuthBackend } from '../auth/oauth.js';
import { SESSION_COOKIE } from '../auth/sessions.js';
import type { AuthEnv } from '../auth/middleware.js';

const STATE_COOKIE = 'cal_oauth_state';
/** The Android app's deep link (custom scheme on its application id); the exchange code rides on it. */
const APP_LINK = 'lan.mordor.calendar://auth';

/**
 * The page the system browser lands on after an app sign-in. It opens the deep link by script and offers a button too:
 * Chrome may refuse to launch an app from a bare 302 without a user gesture. The link carries only the one-time code.
 */
function openAppPage(link: string): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in</title>
<body style="font:16px system-ui;margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;padding:24px"><div>
<p>Signed in. Going back to the app.</p><p><a id="open-app" href="${link}" style="font-size:18px">Open the calendar app</a></p></div>
<script>location.replace(${JSON.stringify(link)});</script></body>`;
}

/** Friendly dead end for a code that is unknown, used or expired (the app shows it in its WebView). */
const EXCHANGE_FAILED_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in</title>
<body style="font:16px system-ui;margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;padding:24px"><div>
<p>This sign-in link has expired or was already used.</p><p><a href="/signin">Sign in again</a></p></div></body>`;

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
    // `app=1`: the Android app runs this round trip in the system browser and gets the session by exchange code
    const state = ctx.auth.states.create(c.req.query('app') === '1');
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, sameSite: 'Lax', path: '/api/auth', maxAge: 600, secure: ctx.config.publicUrl?.startsWith('https://') ?? false });
    return c.redirect(oauth.authUrl(state), 302);
  });

  r.get('/auth/google/callback', async (c) => {
    const oauth = await backend(ctx);
    const code = c.req.query('code');
    const state = c.req.query('state');
    // the state must be one we issued AND belong to this browser (cookie), else it is a forged or replayed callback
    const issued = state ? ctx.auth.states.consume(state) : null;
    if (!code || !state || !issued || getCookie(c, STATE_COOKIE) !== state) throw validation('Invalid state');
    deleteCookie(c, STATE_COOKIE, { path: '/api/auth' });
    const who = await oauth.exchange(code);
    // not on the list (or unverified): keep nothing, not even the token
    if (!who.emailVerified || !ctx.auth.allows(who.email)) return c.redirect('/signin?error=private', 302);
    ctx.people.record(who.sub, who.email, who.name ?? undefined);
    const claimed = claimLegacyToken(ctx.config.dataDir, who.sub);
    const refresh = who.refreshToken ?? claimed;
    if (!refresh) throw validation('Google did not return a refresh token (revoke access and retry)');
    // a response without any scope field says nothing, so it does not count as missing
    const missing = who.scope !== null && !hasCalendarScope(who.scope);
    // a claimed legacy token was not granted by this round trip, so its scope is unknown
    const scope = who.refreshToken ? who.scope : null;
    if (ctx.config.provider === 'google') {
      (await import('../providers/google/auth.js')).storeUserToken(ctx.config, who.sub, refresh, scope);
    } else {
      writeUserToken(ctx.config.dataDir, who.sub, refresh, scope);
      // the mock calendar of this person stands in for Google's answer to the missing scope
      ctx.mockFor(who.sub).setCalendarMissing(missing);
    }
    // the cached provider still holds the old OAuth client (and its access token without the calendar scope): rebuild it
    ctx.forgetPerson(who.sub);
    // a new or wiped server gets the person's data back from their Drive backup (never fails the sign-in)
    await ctx.backup.restoreIfEmpty(who.sub);
    const sessionId = ctx.auth.sessions.create({ sub: who.sub, email: who.email.toLowerCase(), ...(who.name ? { name: who.name } : {}) });
    // signed in, but Google's token response (the authority, not the callback's scope query) lacks the calendar: say so instead of pretending
    const target = missing ? '/?calendar=missing' : '/';
    if (issued.app) {
      // this browser must not keep the session: the app's WebView gets it by redeeming the code
      c.header('Cache-Control', 'no-store');
      return c.html(openAppPage(`${APP_LINK}?code=${ctx.auth.exchanges.create({ sessionId, redirect: target })}`));
    }
    setSessionCookie(ctx, c, sessionId);
    return c.redirect(target, 302);
  });

  // The app's WebView redeems the one-time code from the deep link and gets the normal session cookie.
  r.get('/auth/app-exchange', (c) => {
    c.header('Cache-Control', 'no-store');
    const hit = ctx.auth.exchanges.consume(c.req.query('code'));
    if (!hit) return c.html(EXCHANGE_FAILED_PAGE, 400);
    setSessionCookie(ctx, c, hit.sessionId);
    return c.redirect(hit.redirect, 302);
  });

  // With auth off nobody signs in: answer 200 with nulls so the client can tell "off" from "signed out" (401).
  r.get('/auth/me', (c) => {
    if (!ctx.auth.on) return c.json({ email: null, name: null });
    const p = c.get('person');
    if (!p) throw new ApiException('UNAUTHENTICATED', 401, 'Sign in required');
    return c.json({ email: p.email, name: p.name ?? p.email });
  });

  r.post('/auth/signout', (c) => {
    const p = c.get('person');
    if (p) ctx.forgetPerson(p.sub);
    ctx.auth.sessions.delete(getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  return r;
}
