import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

describe('GET /app.apk', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());

  it('answers 404 while no APK has been put into DATA_DIR/downloads', async () => {
    const res = await t.req('GET', '/app.apk');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

  it('serves DATA_DIR/downloads/app.apk as an Android package download', async () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    fs.mkdirSync(path.join(t.dir, 'downloads'), { recursive: true });
    fs.writeFileSync(path.join(t.dir, 'downloads', 'app.apk'), bytes);
    const res = await t.req('GET', '/app.apk');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.android.package-archive');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-length')).toBe(String(bytes.length));
    expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
  });
});
