import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

describe('GET /api/config apk', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());
  const apk = async () => (await (await t.req('GET', '/api/config')).json()).apk;
  const write = (text: string) => {
    fs.mkdirSync(path.join(t.dir, 'downloads'), { recursive: true });
    fs.writeFileSync(path.join(t.dir, 'downloads', 'app.json'), text);
  };

  it('is null while there is no sidecar', async () => { expect(await apk()).toBeNull(); });
  it('reports the version of DATA_DIR/downloads/app.json', async () => {
    write('{"versionCode":7,"versionName":"1.1.7"}');
    expect(await apk()).toEqual({ versionCode: 7, versionName: '1.1.7' });
  });
  it('is null for a broken sidecar', async () => {
    write('{"versionCode":"x"}');
    expect(await apk()).toBeNull();
    write('not json');
    expect(await apk()).toBeNull();
  });
});
