/** Static serving of the built web app: precompressed assets are served as they are, the rest is compressed on the fly. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { staticRoutes } from '../src/routes/static.js';

const js = `console.log(${JSON.stringify('x'.repeat(2000))});`;
let dir: string;
let app: ReturnType<typeof staticRoutes>;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-static-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>t</title>');
  fs.writeFileSync(path.join(dir, 'app.js'), js);
  fs.writeFileSync(path.join(dir, 'app.js.br'), brotliCompressSync(js));
  fs.writeFileSync(path.join(dir, 'app.js.gz'), gzipSync(js));
  fs.writeFileSync(path.join(dir, 'plain.js'), js);
  app = staticRoutes(dir);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const get = (url: string, encoding: string) => app.request(url, { headers: { 'accept-encoding': encoding } });

describe('precompressed assets', () => {
  it('serves the Brotli file to a browser that accepts it', async () => {
    const res = await get('/app.js', 'gzip, deflate, br');
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('content-type')).toMatch(/javascript/);
    expect(brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString()).toBe(js);
  });

  it('serves the gzip file when Brotli is not accepted', async () => {
    const res = await get('/app.js', 'gzip, deflate');
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(gunzipSync(Buffer.from(await res.arrayBuffer())).toString()).toBe(js);
  });

  it('still compresses a file without precompressed siblings on the fly', async () => {
    const res = await get('/plain.js', 'gzip');
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(gunzipSync(Buffer.from(await res.arrayBuffer())).toString()).toBe(js);
  });

  it('serves the uncompressed file to a client that accepts nothing', async () => {
    const res = await get('/app.js', 'identity');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(js);
  });
});

describe('cache headers', () => {
  it('asks again for the page, its fallback and the worker, so a deploy reaches the next load', async () => {
    fs.writeFileSync(path.join(dir, 'sw.js'), 'self');
    for (const url of ['/index.html', '/', '/some/route', '/sw.js']) {
      expect((await get(url, 'gzip')).headers.get('cache-control'), url).toBe('no-cache');
    }
  });

  it('leaves the hashed assets to the browser cache', async () => {
    expect((await get('/app.js', 'gzip')).headers.get('cache-control')).toBeNull();
  });
});
