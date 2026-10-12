import type { AppConfig } from './config.js';
import { Clock } from './lib/clock.js';
import { formatInZone } from './lib/time.js';
import { CalendarService } from './services/calendar.js';
import { MotivationService } from './services/motivation.js';
import { SettingsStore } from './services/settingsStore.js';
import type { CalendarProvider } from './providers/CalendarProvider.js';
import { MockGoogleProvider } from './providers/mock/MockGoogleProvider.js';
import { seedDemo } from './seed.js';

export const VERSION = process.env.APP_VERSION ?? '0.1.0';

export interface Ctx {
  config: AppConfig;
  clock: Clock;
  provider: CalendarProvider;
  mock: MockGoogleProvider | null;
  settings: SettingsStore;
  motivation: MotivationService;
  calendar: CalendarService;
  /** Test override for /api/config (API.md `/api/__test/config`). */
  overrides: { pollIntervalMs?: number };
  health: { at: number; status: 'ok' | 'unavailable' } | null;
  /** Late-bound hooks. */
  googleAuth?: unknown;
  seed(): Promise<void>;
  close(): void;
}

export function createContext(config: AppConfig, provider?: CalendarProvider, clock = new Clock()): Ctx {
  const mock = provider ? (provider instanceof MockGoogleProvider ? provider : null)
    : config.provider === 'mock' ? new MockGoogleProvider({ dataDir: config.dataDir, tz: config.tz, clock }) : null;
  const prov: CalendarProvider = provider ?? mock ?? (() => { throw new Error('Google provider must be passed in (see index.ts)'); })();
  const settings = new SettingsStore(config.dataDir, clock, config.tz);
  const motivation = new MotivationService(config.dataDir, clock, config.tz);
  const calendar = new CalendarService(prov, settings, motivation, clock, config);
  if (mock) calendar.rawInsert = async (cal, ev) => mock.remote.insert(cal, ev);
  const ctx: Ctx = {
    config, clock, provider: prov, mock, settings, motivation, calendar, overrides: {}, health: null,
    async seed() {
      await seedDemo(calendar, motivation, clock.nowMs(), config.tz);
    },
    close() {
      mock?.close();
    },
  };
  return ctx;
}

export const nowIso = (ctx: Ctx) => formatInZone(ctx.clock.real(), ctx.config.tz);
