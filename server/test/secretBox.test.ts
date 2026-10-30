/** Secrets at rest: AES-256-GCM envelope for Google refresh tokens (ADR 0026). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, seal, validKey } from '../src/lib/secretBox.js';
import { assertSafeToStart, loadConfig } from '../src/config.js';
import { readUserScope, readUserToken, userTokenFile, writeUserToken } from '../src/auth/people.js';

const key = () => randomBytes(32).toString('base64');

describe('secretBox', () => {
  it('round-trips and uses a fresh IV per seal', () => {
    const k = key();
    const a = seal({ x: 1 }, k);
    const b = seal({ x: 1 }, k);
    expect(a).toMatchObject({ v: 1, alg: 'A256GCM' });
    expect(a.iv).not.toBe(b.iv);
    expect(open(a, k)).toEqual({ x: 1 });
  });
  it('rejects a wrong key and a tampered ciphertext', () => {
    const a = seal({ x: 1 }, key());
    expect(open(a, key())).toBeNull();
    const k = key();
    const e = seal({ x: 1 }, k);
    expect(open({ ...e, ct: Buffer.from('zz').toString('base64') }, k)).toBeNull();
  });
  it('validates a key as 32 bytes of base64', () => {
    expect(validKey(key())).toBe(true);
    expect(validKey(randomBytes(16).toString('base64'))).toBe(false);
    expect(validKey(undefined)).toBe(false);
  });
});

describe('token file at rest', () => {
  let dir: string;
  const saved = process.env.TOKEN_ENC_KEY;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-enc-')); });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.TOKEN_ENC_KEY; else process.env.TOKEN_ENC_KEY = saved;
  });
  const raw = () => fs.readFileSync(userTokenFile(dir, 'u1'), 'utf8');

  it('writes an envelope without the plaintext token when a key is set', () => {
    process.env.TOKEN_ENC_KEY = key();
    writeUserToken(dir, 'u1', 'refresh-secret', 'a b');
    expect(raw()).not.toContain('refresh-secret');
    expect(JSON.parse(raw())).toMatchObject({ v: 1, alg: 'A256GCM' });
    expect(readUserToken(dir, 'u1')).toBe('refresh-secret');
    expect(readUserScope(dir, 'u1')).toBe('a b');
    expect(fs.statSync(userTokenFile(dir, 'u1')).mode & 0o777).toBe(0o600);
  });
  it('re-writes a legacy plaintext file encrypted on first read', () => {
    delete process.env.TOKEN_ENC_KEY;
    writeUserToken(dir, 'u1', 'legacy-rt', 's');
    expect(raw()).toContain('legacy-rt');
    process.env.TOKEN_ENC_KEY = key();
    expect(readUserToken(dir, 'u1')).toBe('legacy-rt');
    expect(raw()).not.toContain('legacy-rt');
    expect(readUserToken(dir, 'u1')).toBe('legacy-rt');
    expect(readUserScope(dir, 'u1')).toBe('s');
  });
  it('treats a wrong key or a tampered file as not connected, without throwing', () => {
    process.env.TOKEN_ENC_KEY = key();
    writeUserToken(dir, 'u1', 'rt');
    process.env.TOKEN_ENC_KEY = key();
    expect(readUserToken(dir, 'u1')).toBeNull();
    expect(readUserScope(dir, 'u1')).toBeNull();
    fs.writeFileSync(userTokenFile(dir, 'u1'), '{"v":1,"alg":"A256GCM","iv":"x","tag":"y","ct":"z"}');
    expect(readUserToken(dir, 'u1')).toBeNull();
  });
  it('an envelope without any key is not connected', () => {
    process.env.TOKEN_ENC_KEY = key();
    writeUserToken(dir, 'u1', 'rt');
    delete process.env.TOKEN_ENC_KEY;
    expect(readUserToken(dir, 'u1')).toBeNull();
  });
  it('stays plaintext without a key (tests, TEST_MODE)', () => {
    delete process.env.TOKEN_ENC_KEY;
    writeUserToken(dir, 'u1', 'plain');
    expect(JSON.parse(raw())).toEqual({ refresh_token: 'plain' });
  });
});

describe('startup guard', () => {
  const cfg = (e: Record<string, string>) => loadConfig({ PROVIDER: 'google', ...e });
  it('refuses google without a valid key unless TEST_MODE', () => {
    expect(() => assertSafeToStart(cfg({}), {})).toThrow(/TOKEN_ENC_KEY/);
    expect(() => assertSafeToStart(cfg({}), { TOKEN_ENC_KEY: 'short' })).toThrow(/TOKEN_ENC_KEY/);
    expect(() => assertSafeToStart(cfg({}), { TOKEN_ENC_KEY: key() })).not.toThrow();
    expect(() => assertSafeToStart(cfg({ TEST_MODE: '1' }), {})).not.toThrow();
  });
});
