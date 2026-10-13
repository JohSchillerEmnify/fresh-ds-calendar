import fs from 'node:fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sessionMiddleware } from './auth/middleware.js';
import { ApiException } from './lib/errors.js';
import { NotFoundError, PreconditionFailedError, ProviderError, ProviderUnavailableError, ReauthRequiredError, type CalendarProvider } from './providers/CalendarProvider.js';
import { apiRoutes } from './api/routes.js';
import { testRoutes } from './api/testRoutes.js';
import { authRoutes } from './api/authRoutes.js';
import { createContext, type Ctx } from './context.js';
import type { AppConfig } from './config.js';
import type { Clock } from './lib/clock.js';
import { downloadRoutes } from './routes/download.js';
import { staticRoutes } from './routes/static.js';

export type App = Hono & { ctx: Ctx; close(): void };

export interface BuildOptions {
  provider?: CalendarProvider;
  clock?: Clock;
  /** PROVIDER=google: builds one person's provider. */
  personProvider?: (sub: string) => CalendarProvider;
}

/**
 * Builds the HTTP app. Pure web-standard Request/Response (Hono): tests use `app.request()`, the runtime adapter
 * lives only in index.ts. Seeding is the caller's job (see `startup()` in index.ts / `ctx.seed()`).
 */
export function buildApp(config: AppConfig, opts: BuildOptions = {}): App {
  const ctx = createContext(config, opts.provider, opts.clock, opts.personProvider);
  const app = new Hono() as App;
  app.ctx = ctx;
  app.close = () => ctx.close();

  if (config.allowedOrigins.length) {
    app.use('/api/*', cors({ origin: (o) => (config.allowedOrigins.includes(o) ? o : null), allowHeaders: ['Content-Type', 'If-Match'], exposeHeaders: ['X-Motivation-Changed'] }));
  }

  app.use('/api/*', sessionMiddleware(ctx));

  const api = new Hono();
  api.route('/', apiRoutes(ctx));
  if (config.testMode && ctx.mock) api.route('/', testRoutes(ctx));
  api.route('/', authRoutes(ctx));
  app.route('/api', api);
  app.all('/api/*', () => {
    throw new ApiException('NOT_FOUND', 404, 'Not found');
  });

  app.onError((err, c) => {
    const body = (code: string, message: string, details?: unknown, key?: string) => ({ error: { code, message, ...(key ? { key } : {}), ...(details ? { details } : {}) } });
    if (err instanceof ApiException) return c.json(body(err.code, err.message, err.details, err.key), err.status);
    if (err instanceof ReauthRequiredError) return c.json(body('GOOGLE_REAUTH', 'Google no longer accepts your access. Sign in with Google again.'), 401);
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
