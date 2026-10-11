import fs from 'node:fs';
import { Hono } from 'hono';
import type { AppConfig } from './config.js';
import { healthRoutes } from './routes/health.js';
import { staticRoutes } from './routes/static.js';

export type App = Hono;

/**
 * Builds the HTTP app. Pure web-standard Request/Response (Hono), so tests use `app.request()`
 * and the runtime adapter (node-server today) lives only in index.ts.
 */
export function buildApp(config: AppConfig): App {
  const app = new Hono();

  const api = new Hono();
  api.route('/', healthRoutes(config));
  // Later: event / tasklist / settings routes backed by a CalendarProvider (see ./providers).
  app.route('/api', api);
  // Unknown API paths must stay JSON 404 and never hit the SPA fallback below.
  app.all('/api/*', (c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  const hasWeb = config.webDist !== null && fs.existsSync(config.webDist);
  if (hasWeb) app.route('/', staticRoutes(config.webDist!));

  app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));
  return app;
}
