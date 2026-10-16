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
  google: {
    clientId: string | null;
    clientSecret: string | null;
    refreshToken: string | null;
    calendarIds: string[];
    redirectUri: string | null;
  };
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
