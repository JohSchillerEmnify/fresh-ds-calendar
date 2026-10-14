import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { serveStatic } from '@hono/node-server/serve-static';

/** Serves the built web app; unknown non-API GETs fall back to index.html (client-side router). */
export function staticRoutes(webDist: string, versionOverride: () => string | undefined = () => undefined) {
  const root = path.resolve(webDist);
  return new Hono()
    .use('*', compress()) // gzip for whatever has no precompressed file; the first-load JS budget is measured compressed
    // TEST_MODE "deploy" (`/api/__test/version`): the shell reports the overridden build version after a reload.
    .use('*', async (c, next) => {
      const version = versionOverride();
      const p = c.req.path;
      if (!version || c.req.method !== 'GET' || p.startsWith('/api/') || (path.extname(p) !== '' && p !== '/index.html')) return next(); // /index.html too: the service worker precaches it
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/data-app-version="[^"]*"/, `data-app-version="${version}"`);
      return c.html(html);
    })
    // `<file>.br` / `<file>.gz` written by web/scripts/precompress.mjs are served as is when the browser accepts them
    .use('*', serveStatic({ root, precompressed: true }))
    .get('*', serveStatic({ root, path: 'index.html', precompressed: true }));
}
