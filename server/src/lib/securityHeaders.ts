/**
 * Browser security headers (CSP, X-Frame-Options, Permissions-Policy) for the server's own answers.
 *
 * The public instance gets the same headers from Caddy (`deploy/vps/Caddyfile`); a local run has no Caddy, so the server
 * sends them itself. The CSP allows exactly the inline scripts found in the served `index.html` by sha256, computed
 * from the built file at start, so the policy cannot go stale against the page it protects. `test/security-headers.test.ts`
 * keeps the Caddyfile copy in step.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MiddlewareHandler } from 'hono';
import { DEFAULT_MAP_TILE_URL, DEFAULT_PLACE_SEARCH_URL } from '../config.js';

/** Where the device asks for places and map pictures (`AppConfig.places`). */
export interface PlaceHosts { searchUrl: string; tileUrl: string }

const DEFAULT_HOSTS: PlaceHosts = { searchUrl: DEFAULT_PLACE_SEARCH_URL, tileUrl: DEFAULT_MAP_TILE_URL };

/** The origin of a URL or URL template (`{z}`-style placeholders only occur in the path). */
const originOf = (url: string) => new URL(url.replace(/[{}]/g, '')).origin;

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
 * Besides the app itself it allows exactly the place search and the map picture host (feature event-location): the page
 * asks the place search (`connect-src`) and shows the map pictures (`img-src`); the service worker fetches the pictures
 * it keeps for offline use, and a worker's fetch falls under `connect-src`, so the picture host is there too.
 *
 * @param scriptHashes Hash expressions from {@link inlineScriptHashes}, allowed next to `'self'` for scripts.
 * @param hosts The configured place search and map picture addresses; the public defaults when omitted.
 * @returns The policy as one header value.
 */
export function contentSecurityPolicy(scriptHashes: string[], hosts: PlaceHosts = DEFAULT_HOSTS): string {
  const search = originOf(hosts.searchUrl), tiles = originOf(hosts.tileUrl);
  return [
    "default-src 'self'",
    `script-src ${["'self'", ...scriptHashes].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${tiles}`,
    `connect-src 'self' ${search === tiles ? search : `${search} ${tiles}`}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** The Permissions-Policy value (the app uses none of these features). */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()';

/**
 * The Referrer-Policy value: the browsers' own default, sent explicitly so a local run matches the public instance. Never
 * stricter: the OSM tile policy asks web pages to send their origin as Referer.
 */
export const REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * Hono middleware that sets the security headers on every response.
 *
 * @param webDist Directory of the built web app; its `index.html` supplies the inline script hashes (none when absent).
 * @param hosts The configured place search and map picture addresses (`AppConfig.places`).
 * @returns The middleware.
 */
export function securityHeaders(webDist: string | null, hosts: PlaceHosts = DEFAULT_HOSTS): MiddlewareHandler {
  let html = '';
  try {
    if (webDist) html = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
  } catch {
    // no built web app (API-only run): the policy then simply allows no inline script
  }
  const csp = contentSecurityPolicy(inlineScriptHashes(html), hosts);
  return async (c, next) => {
    c.header('Content-Security-Policy', csp);
    c.header('X-Frame-Options', 'DENY');
    c.header('Permissions-Policy', PERMISSIONS_POLICY);
    c.header('Referrer-Policy', REFERRER_POLICY);
    await next();
  };
}
