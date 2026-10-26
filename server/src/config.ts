import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEmails } from './auth/people.js';
import { isValidTimeZone } from './lib/time.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export type ProviderKind = 'mock' | 'google';

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  provider: ProviderKind;
  /** Directory of the built web app; null disables static serving. */
  webDist: string | null;
  /** CHANGELOG.md the release notes are parsed from at start (a missing file means no notes). */
  changelogPath: string;
  tz: string;
  seed: boolean;
  testMode: boolean;
  pollIntervalMs: number;
  publicUrl: string | null;
  allowedOrigins: string[];
  /** Google addresses that may sign in (auth is on with PROVIDER=google). */
  allowedEmails: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /**
   * Where the device asks for places and map pictures, straight from the device (feature event-location): the Photon
   * search endpoint and the tile URL template with `{z}`, `{x}`, `{y}`. `PLACE_SEARCH_URL` / `MAP_TILE_URL` override them.
   */
  places: { searchUrl: string; tileUrl: string };
  /** Door plugin (ADR 0003/0004): the board's bearer key and the person whose calendar it sees; no token = no door. */
  door: { token: string | null; person: string | null };
  google: {
    clientId: string | null;
    clientSecret: string | null;
    refreshToken: string | null;
    calendarIds: string[];
    redirectUri: string | null;
  };
}

/** The public Photon instance (OpenStreetMap data, no key; owner, board item g6). */
export const DEFAULT_PLACE_SEARCH_URL = 'https://photon.komoot.io/api';
/** The OpenStreetMap Foundation's standard tile server (tile usage policy: credit, Referer, no prefetching). */
export const DEFAULT_MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * A plain https address: a host of letters, digits, dots and dashes, an optional port, and a path without spaces, quotes,
 * `;` or `,`. No user name or password. The origin ends up in the CSP, so nothing may break out of a directive.
 */
const SAFE_HTTPS = /^https:\/\/[a-z0-9.-]+(:\d{1,5})?(\/[^\s;,'"]*)?$/i;

/**
 * An https URL from the environment, else the default (a typo must not point the device at an unknown or plain-http
 * host, nor inject into the CSP).
 *
 * @param v The environment value.
 * @param fallback The default address.
 * @param ok An extra check of the value (e.g. the tile placeholders).
 * @returns The value when it is a safe https address that passes `ok`, else `fallback`.
 */
function httpsUrl(v: string | undefined, fallback: string, ok: (u: string) => boolean = () => true): string {
  return v && SAFE_HTTPS.test(v) && ok(v) ? v : fallback;
}

const bool = (v: string | undefined, d: boolean) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));
const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const publicUrl = env.PUBLIC_URL?.replace(/\/+$/, '') || null;
  const tz = env.TZ && isValidTimeZone(env.TZ) ? env.TZ : 'Europe/Berlin';
  const poll = Number(env.POLL_INTERVAL_MS ?? 30000);
  const testMode = bool(env.TEST_MODE, false);
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    dataDir: env.DATA_DIR ?? path.resolve('data'),
    provider: env.PROVIDER === 'google' ? 'google' : 'mock',
    webDist: env.WEB_DIST ?? path.resolve(here, '../../web/dist'),
    changelogPath: env.CHANGELOG_PATH ?? path.resolve(here, '../../CHANGELOG.md'),
    tz,
    seed: bool(env.SEED, true) && !testMode,
    testMode,
    pollIntervalMs: Number.isFinite(poll) && poll >= 0 ? poll : 30000,
    publicUrl,
    allowedOrigins: [...new Set([...(publicUrl ? [publicUrl] : []), ...list(env.ALLOWED_ORIGINS)])],
    allowedEmails: parseEmails(env.ALLOWED_EMAILS),
    logLevel: (['debug', 'info', 'warn', 'error'] as const).find((l) => l === env.LOG_LEVEL) ?? 'info',
    places: {
      searchUrl: httpsUrl(env.PLACE_SEARCH_URL, DEFAULT_PLACE_SEARCH_URL),
      tileUrl: httpsUrl(env.MAP_TILE_URL, DEFAULT_MAP_TILE_URL, (u) => ['{z}', '{x}', '{y}'].every((k) => u.includes(k))),
    },
    door: { token: env.DOOR_API_TOKEN || null, person: parseEmails(env.DOOR_PERSON)[0] ?? null },
    google: {
      clientId: env.GOOGLE_CLIENT_ID || null,
      clientSecret: env.GOOGLE_CLIENT_SECRET || null,
      refreshToken: env.GOOGLE_REFRESH_TOKEN || null,
      calendarIds: list(env.GOOGLE_CALENDAR_IDS ?? 'primary'),
      redirectUri: env.GOOGLE_REDIRECT_URI || (publicUrl ? `${publicUrl}/api/auth/google/callback` : null),
    },
  };
}

/**
 * Refuses to run without sign-in where it would be public: mock mode is auth-off, so with an https `PUBLIC_URL` or
 * `NODE_ENV=production` it must be asked for explicitly (`ALLOW_INSECURE_MOCK=1`). A missing `PROVIDER` counts as mock.
 *
 * @param config The loaded configuration.
 * @param env Environment with `NODE_ENV` and `ALLOW_INSECURE_MOCK`.
 * @throws Error When the configuration would serve everybody without sign-in.
 */
export function assertSafeToStart(config: AppConfig, env: NodeJS.ProcessEnv = process.env): void {
  if (config.provider !== 'mock' || env.ALLOW_INSECURE_MOCK === '1') return;
  if (config.publicUrl?.startsWith('https://') || env.NODE_ENV === 'production') {
    throw new Error('Refusing to start without sign-in (PROVIDER is not "google") on a public address. Set PROVIDER=google, or ALLOW_INSECURE_MOCK=1 to run open on purpose.');
  }
}
