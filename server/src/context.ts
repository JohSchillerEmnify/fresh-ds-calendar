import type { AppConfig } from './config.js';
import { AuthState } from './auth/state.js';
import { Clock } from './lib/clock.js';
import { formatInZone } from './lib/time.js';
import { CalendarService } from './services/calendar.js';
import { MotivationService } from './services/motivation.js';
import { LOCAL_PERSON, PrefsStore } from './services/prefsStore.js';
import { SettingsStore } from './services/settingsStore.js';
import { ThemeStore } from './services/themeStore.js';
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
  prefs: PrefsStore;
  themes: ThemeStore;
  motivation: MotivationService;
  calendar: CalendarService;
  auth: AuthState;
  /** PROVIDER=google: builds one person's provider (one OAuth client per person). */
  personProvider?: (sub: string) => CalendarProvider;
  /** Test override for /api/config (API.md `/api/__test/config`). */
  overrides: { pollIntervalMs?: number; version?: string };
  health: { at: number; status: 'ok' | 'unavailable' } | null;
  /** The calendar of the signed-in person; the shared one when auth is off. */
  calendarFor(sub: string | null | undefined): CalendarService;
  /** Mock calendar of one person (TEST_MODE): separate data per Google account. */
  mockFor(sub: string): MockGoogleProvider;
  /** Forgets all per-person calendars (test reset). */
  resetPeople(): void;
  seed(): Promise<void>;
  close(): void;
}

export function createContext(config: AppConfig, provider?: CalendarProvider, clock = new Clock(), personProvider?: (sub: string) => CalendarProvider): Ctx {
  const mock = provider ? (provider instanceof MockGoogleProvider ? provider : null)
    : config.provider === 'mock' ? new MockGoogleProvider({ dataDir: config.dataDir, tz: config.tz, clock }) : null;
  const prov: CalendarProvider = provider ?? mock ?? (() => { throw new Error('Google provider must be passed in (see index.ts)'); })();
  const settings = new SettingsStore(config.dataDir, clock, config.tz);
  const prefs = new PrefsStore(config.dataDir);
  const themes = new ThemeStore(config.dataDir);
  const motivation = new MotivationService(config.dataDir, clock, config.tz);
  const calendar = new CalendarService(prov, settings, motivation, clock, config, prefs, LOCAL_PERSON);
  if (mock) calendar.rawInsert = async (cal, ev) => mock.remote.insert(cal, ev);
  const mocks = new Map<string, MockGoogleProvider>();
  const people = new Map<string, CalendarService>();
  const ctx: Ctx = {
    config, clock, provider: prov, mock, settings, prefs, themes, motivation, calendar, overrides: {}, health: null, personProvider,
    auth: new AuthState(config, () => clock.real()),
    mockFor(sub) {
      let m = mocks.get(sub);
      if (!m) mocks.set(sub, (m = new MockGoogleProvider({ dataDir: null, tz: config.tz, clock })));
      return m;
    },
    calendarFor(sub) {
      if (!ctx.auth.on || !sub) return calendar;
      let c = people.get(sub);
      if (!c) {
        // google: one provider per person; mock: one calendar per person; tests with an injected provider share it
        const p = personProvider ? personProvider(sub) : mock ? ctx.mockFor(sub) : null;
        if (!p) return calendar;
        people.set(sub, (c = new CalendarService(p, settings, motivation, clock, config, prefs, sub)));
      }
      return c;
    },
    resetPeople() {
      people.clear();
      mocks.clear();
    },
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
