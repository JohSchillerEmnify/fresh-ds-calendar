import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { serveStatic } from '@hono/node-server/serve-static';

/** Serves the built web app; unknown non-API GETs fall back to index.html (client-side router). */
export function staticRoutes(webDist: string, versionOverride: () => string | undefined = () => undefined) {
  const root = path.resolve(webDist);
  return new Hono()
    .use('*', compress()) // gzip: the first-load JS budget is measured compressed
    // TEST_MODE "deploy" (`/api/__test/version`): the shell reports the overridden build version after a reload.
    .use('*', async (c, next) => {
      const version = versionOverride();
      const p = c.req.path;
      if (!version || c.req.method !== 'GET' || p.startsWith('/api/') || path.extname(p) !== '') return next();
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/data-app-version="[^"]*"/, `data-app-version="${version}"`);
      return c.html(html);
    })
    .use('*', serveStatic({ root }))
    .get('*', serveStatic({ root, path: 'index.html' }));
}
