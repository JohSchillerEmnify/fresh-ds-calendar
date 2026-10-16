/**
 * Browser security headers (CSP, X-Frame-Options, Permissions-Policy) for the server's own answers.
 *
 * The public instance gets the same headers from Caddy (`deploy/vps/Caddyfile`); sauron has no Caddy, so the server
 * sends them itself. The CSP allows exactly the inline scripts found in the served `index.html` by sha256, computed
 * from the built file at start, so the policy cannot go stale against the page it protects. `test/security-headers.test.ts`
 * keeps the Caddyfile copy in step.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MiddlewareHandler } from 'hono';

/** Matches `<script>` elements without a `src` attribute and captures their text. */
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

/**
 * Computes the CSP source expressions of every inline script in an HTML document.
 *
 * @param html The HTML text, as served to the browser.
 * @returns One `'sha256-<base64>'` expression per inline script, quotes included.
 */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]!).digest('base64')}'`);
}

/**
 * Builds the Content-Security-Policy value.
 *
 * @param scriptHashes Hash expressions from {@link inlineScriptHashes}, allowed next to `'self'` for scripts.
 * @returns The policy as one header value.
 */
export function contentSecurityPolicy(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src ${["'self'", ...scriptHashes].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** The Permissions-Policy value (the app uses none of these features). */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

/**
 * Hono middleware that sets the security headers on every response.
 *
 * @param webDist Directory of the built web app; its `index.html` supplies the inline script hashes (none when absent).
 * @returns The middleware.
 */
export function securityHeaders(webDist: string | null): MiddlewareHandler {
  let html = '';
  try {
    if (webDist) html = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
  } catch {
    // no built web app (API-only run): the policy then simply allows no inline script
  }
  const csp = contentSecurityPolicy(inlineScriptHashes(html));
  return async (c, next) => {
    c.header('Content-Security-Policy', csp);
    c.header('X-Frame-Options', 'DENY');
    c.header('Permissions-Policy', PERMISSIONS_POLICY);
    await next();
  };
}
