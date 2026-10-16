import { createHash } from 'node:crypto';
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

describe('GET /app.json', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());
  const dir = () => path.join(t.dir, 'downloads');
  const cert = 'ab'.repeat(32);

  it('answers 404 while there is no APK', async () => {
    expect((await t.req('GET', '/app.json')).status).toBe(404);
  });

  it('holds the sha256 of the served APK next to the sidecar fields and the pinned fingerprint', async () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 9, 8, 7]);
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(path.join(dir(), 'app.apk'), bytes);
    fs.writeFileSync(path.join(dir(), 'app.json'), JSON.stringify({ versionCode: 7, versionName: '1.1.7', certSha256: cert.toUpperCase() }));
    const res = await t.req('GET', '/app.json');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ versionCode: 7, versionName: '1.1.7', certSha256: cert, sha256: createHash('sha256').update(bytes).digest('hex') });
  });

  it('follows a replaced APK and leaves out a malformed fingerprint', async () => {
    const bytes = Buffer.from('a new apk');
    fs.writeFileSync(path.join(dir(), 'app.apk'), bytes);
    fs.writeFileSync(path.join(dir(), 'app.json'), JSON.stringify({ versionCode: 8, versionName: '1.1.8', certSha256: 'nope' }));
    expect(await (await t.req('GET', '/app.json')).json()).toEqual({ versionCode: 8, versionName: '1.1.8', sha256: createHash('sha256').update(bytes).digest('hex') });
  });
});
