import fs from 'node:fs';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { sessionMiddleware } from './auth/middleware.js';
import { requestGuards } from './api/guards.js';
import { ApiException } from './lib/errors.js';
import { NotFoundError, PreconditionFailedError, ProviderError, ProviderUnavailableError, ReauthRequiredError, CalendarPermissionMissingError, RateLimitedError, type CalendarProvider } from './providers/CalendarProvider.js';
import { apiRoutes } from './api/routes.js';
import { testRoutes } from './api/testRoutes.js';
import { authRoutes } from './api/authRoutes.js';
import { causeFor, logEvent, noteCause } from './lib/diag.js';
import { routePath } from 'hono/route';
import { diagRoutes } from './api/diagRoutes.js';
import { createContext, type Ctx } from './context.js';
import type { AppConfig } from './config.js';
import type { Clock } from './lib/clock.js';
import type { DriveClient } from './providers/DriveClient.js';
import { liveRoutes } from './api/liveRoutes.js';
import { pushRoutes } from './api/pushRoutes.js';
import { backupRoutes } from './api/backupRoutes.js';
import { downloadRoutes } from './routes/download.js';
import { staticRoutes } from './routes/static.js';
import { securityHeaders } from './lib/securityHeaders.js';
import { pluginRoutes } from './plugins/registry.js';

export type App = Hono & { ctx: Ctx; close(): void };

export interface BuildOptions {
  provider?: CalendarProvider;
  clock?: Clock;
  /** PROVIDER=google: builds one person's provider. */
  personProvider?: (sub: string) => CalendarProvider;
  /** PROVIDER=google: one person's hidden Drive app folder. */
  driveFor?: (sub: string) => DriveClient;
}

/**
 * Builds the HTTP app. Pure web-standard Request/Response (Hono): tests use `app.request()`, the runtime adapter
 * lives only in index.ts. Seeding is the caller's job (see `startup()` in index.ts / `ctx.seed()`).
 */
export function buildApp(config: AppConfig, opts: BuildOptions = {}): App {
  const ctx = createContext(config, opts.provider, opts.clock, opts.personProvider, opts.driveFor);
  const app = new Hono() as App;
  app.ctx = ctx;
  app.close = () => ctx.close();
  app.use('*', securityHeaders(config.webDist, config.places)); // CSP, X-Frame-Options, Permissions-Policy, Referrer-Policy on every answer

  if (config.allowedOrigins.length) {
    app.use('/api/*', cors({ origin: (o) => (config.allowedOrigins.includes(o) ? o : null), allowHeaders: ['Content-Type', 'If-Match'], exposeHeaders: ['X-Motivation-Changed', 'X-Stale', 'Retry-After'] }));
  }

  // Diagnostics: every API answer with status >= 500 leaves one line, with the cause the error handler noted.
  app.use('/api/*', async (c, next) => {
    const started = Date.now();
    await next();
    // a rate-limited answer is logged once per cooldown (`rate_limited`), not per request
    if (c.res.status >= 500 && causeFor(c) !== RateLimitedError.name) {
      logEvent('api_unavailable', { route: `${c.req.method} ${routePath(c)}`, status: c.res.status, durationMs: Date.now() - started, cause: causeFor(c) });
    }
  });

  app.use('/api/*', requestGuards(config));

  // Test mode: "the server answers only after N seconds" (POST /api/__test/slow); the test hooks themselves stay quick.
  if (config.testMode) {
    app.use('/api/*', async (c, next) => {
      const ms = ctx.overrides.slowMs;
      if (ms && !c.req.path.startsWith('/api/__test/')) await new Promise((r) => setTimeout(r, ms));
      await next();
    });
  }

  // Plugins (ADR 0004) answer machine clients with their own keys: mounted before the session middleware, gated per request.
  app.route('/api', pluginRoutes(ctx));

  app.use('/api/*', sessionMiddleware(ctx));

  // A successful write by a signed-in person may have changed their server data: schedule their backup. One place for
  // every store, so a new per-person store needs no call (it is "a change" like any other write).
  app.use('/api/*', async (c: Context, next) => {
    await next();
    const p = c.get('person') as { sub: string } | undefined;
    const path = c.req.path;
    if (!p || c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS' || c.res.status >= 400) return;
    if (path.startsWith('/api/backup') || path.startsWith('/api/auth/') || path.startsWith('/api/__test/') || path === '/api/reminders/plan') return; // the push plan is device state, not data to back up
    ctx.backup.touch(p.sub);
  });

  const api = new Hono();
  api.route('/', backupRoutes(ctx));
  api.route('/', pushRoutes(ctx));
  api.route('/', liveRoutes(ctx)); // before apiRoutes: `/events/stream` must not be read as an event id
  api.route('/', apiRoutes(ctx));
  if (config.testMode && ctx.mock) api.route('/', testRoutes(ctx));
  api.route('/', authRoutes(ctx));
  api.route('/', diagRoutes(ctx));
  app.route('/api', api);
  app.all('/api/*', () => {
    throw new ApiException('NOT_FOUND', 404, 'Not found');
  });

  app.onError((err, c) => {
    const body = (code: string, message: string, details?: unknown, key?: string) => ({ error: { code, message, ...(key ? { key } : {}), ...(details ? { details } : {}) } });
    noteCause(c, causeFor(err) ?? err.constructor.name);
    if (err instanceof ApiException) return c.json(body(err.code, err.message, err.details, err.key), err.status);
    if (err instanceof ReauthRequiredError) return c.json(body('GOOGLE_REAUTH', 'Google no longer accepts your access. Sign in with Google again.'), 401);
    if (err instanceof CalendarPermissionMissingError) return c.json(body('CALENDAR_PERMISSION_MISSING', 'Google Calendar access was not granted. Sign in with Google again and tick the calendar checkbox.'), 403);
    if (err instanceof RateLimitedError) return c.json(body('RATE_LIMITED', 'Google is limiting requests right now. Try again shortly.'), 503, { 'Retry-After': String(err.retryAfterSec) });
    if (err instanceof ProviderUnavailableError) return c.json(body('PROVIDER_UNAVAILABLE', 'Google Calendar is unavailable'), 503);
    if (err instanceof PreconditionFailedError) return c.json(body('PRECONDITION_FAILED', 'This item was changed elsewhere. Reload it and try again.'), 412);
    if (err instanceof NotFoundError) return c.json(body('NOT_FOUND', 'Not found'), 404);
    if (err instanceof ProviderError) return c.json(body('PROVIDER_ERROR', 'Google Calendar returned an error'), 502);
    if (err instanceof SyntaxError) return c.json(body('VALIDATION_ERROR', 'Request body must be valid JSON'), 400);
    if (config.logLevel !== 'error') console.error(err);
    return c.json(body('INTERNAL', 'Internal server error'), 500);
  });

  app.route('/', downloadRoutes(config.dataDir)); // before the static routes, whose SPA fallback would answer /app.apk with index.html

  const hasWeb = config.webDist !== null && fs.existsSync(config.webDist);
  if (hasWeb) app.route('/', staticRoutes(config.webDist!, () => ctx.overrides.version));
  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
  return app;
}
