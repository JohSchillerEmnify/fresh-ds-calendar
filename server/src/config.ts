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
  tz: string;
  seed: boolean;
  testMode: boolean;
  pollIntervalMs: number;
  tasklistCalendarId: string;
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
    tz,
    seed: bool(env.SEED, true) && !testMode,
    testMode,
    pollIntervalMs: Number.isFinite(poll) && poll >= 0 ? poll : 30000,
    tasklistCalendarId: env.TASKLIST_CALENDAR_ID || 'primary',
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
