/** Browser security headers: the server sends them, and the Caddyfile copy matches the built page's inline script. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { contentSecurityPolicy, inlineScriptHashes, PERMISSIONS_POLICY } from '../src/lib/securityHeaders.js';
import { loadConfig } from '../src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
/** True only when web/dist/index.html exists and is at least as new as the source (a real build, not a stale leftover). */
function distIsFresh(): boolean {
  const dist = path.join(root, 'web/dist/index.html');
  const src = path.join(root, 'web/index.html');
  if (!fs.existsSync(dist)) return false;
  return fs.statSync(dist).mtimeMs >= fs.statSync(src).mtimeMs;
}

describe('security headers', () => {
  it('hashes the inline theme script of web/index.html', () => {
    expect(inlineScriptHashes(read('web/index.html'))).toHaveLength(1);
  });

  it('keeps the Caddyfile policy equal to the server policy for the current inline script', () => {
    const csp = contentSecurityPolicy(inlineScriptHashes(read('web/index.html')));
    const caddy = read('deploy/vps/Caddyfile');
    expect(caddy).toContain(`Content-Security-Policy "${csp}"`);
    expect(caddy).toContain(`Permissions-Policy "${PERMISSIONS_POLICY}"`);
    expect(caddy).toContain('X-Frame-Options DENY');
  });

  // Vite must not rewrite the inline script: the hash of the built page is the one the browser checks. Only meaningful
  // against a FRESH build — skip a dist older than the source (a stale leftover would give a false mismatch; e.g. a host
  // whose real build happens inside Docker and never refreshes web/dist).
  it.skipIf(!distIsFresh())('built web/dist/index.html has the same inline script hashes as the source', () => {
    expect(inlineScriptHashes(read('web/dist/index.html'))).toEqual(inlineScriptHashes(read('web/index.html')));
  });

  it('sends the headers on API, static and 404 answers, with the hash of the served index.html', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sec-'));
    const app = buildApp({ ...loadConfig({ TEST_MODE: 'true', DATA_DIR: dir }), webDist: path.join(root, 'web') });
    const want = contentSecurityPolicy(inlineScriptHashes(read('web/index.html')));
    for (const url of ['/api/health', '/index.html', '/api/nope']) {
      const res = await app.request(url);
      expect(res.headers.get('content-security-policy'), url).toBe(want);
      expect(res.headers.get('x-frame-options'), url).toBe('DENY');
      expect(res.headers.get('permissions-policy'), url).toBe(PERMISSIONS_POLICY);
    }
    app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
