import path from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

/** Serves the built web app; unknown non-API GETs fall back to index.html (client-side router). */
export function staticRoutes(webDist: string) {
  const root = path.resolve(webDist);
  return new Hono()
    .use('*', serveStatic({ root }))
    .get('*', serveStatic({ root, path: 'index.html' }));
}
