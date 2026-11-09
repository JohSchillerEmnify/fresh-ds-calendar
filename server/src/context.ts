import type { AppConfig } from './config.js';
import { AuthState } from './auth/state.js';
import { PeopleStore } from './auth/peopleStore.js';
import { Clock } from './lib/clock.js';
import { CanvasStore } from './services/canvasStore.js';
import { InkStore } from './services/inkStore.js';
import { InkService } from './services/inkService.js';
import { IdempotencyStore } from './services/idempotencyStore.js';
import { TemplateStore } from './services/templateStore.js';
import { CalendarService } from './services/calendar.js';
import { MotivationService } from './services/motivation.js';
import { knownSubs, splitServerWideFiles } from './services/personSplit.js';
import { LOCAL_PERSON, PrefsStore } from './services/prefsStore.js';
import { ChangeBus } from './services/changeBus.js';
import { LivePublisher } from './services/livePublisher.js';
import { GooglePoller } from './services/googlePoller.js';
import { SettingsStore } from './services/settingsStore.js';
import { SharedListService } from './services/sharedLists.js';
import { ThemeStore, vetRestoredFile } from './services/themeStore.js';
import { BackupService } from './services/backupService.js';
import { CalendarPlanScheduler } from './services/calendarPlanScheduler.js';
import { PushService, RecordingSender, loadVapid, webPushSender } from './services/push.js';
import { registerServerFilesBackup } from './services/serverFilesBackup.js';
import { registerSharedListsBackup } from './services/sharedListsBackup.js';
import { hasDriveScope } from './auth/people.js';
import type { DriveClient } from './providers/DriveClient.js';
import { MockDrive } from './providers/mock/MockDrive.js';
import path from 'node:path';
import type { CalendarProvider } from './providers/CalendarProvider.js';
import { MockGoogleProvider } from './providers/mock/MockGoogleProvider.js';
import { seedDemo } from './seed.js';
import type { ApkInfo } from './routes/download.js';
import type { TestPlace } from './api/testPlaces.js';
import { loadReleaseNotes, type ReleaseNote } from './services/releaseNotes.js';

export const VERSION = process.env.APP_VERSION ?? '0.1.0';

export interface Ctx {
  config: AppConfig;
  clock: Clock;
  provider: CalendarProvider;
  mock: MockGoogleProvider | null;
  settings: SettingsStore;
  prefs: PrefsStore;
  themes: ThemeStore;
  canvas: CanvasStore;
  ink: InkStore;
  inks: InkService;
  idempotency: IdempotencyStore;
  templates: TemplateStore;
  /** Backups of every person's server data to their hidden Drive app folder (feature drive-backup). */
  backup: BackupService;
  /** Every successful write of the API is reported here (ADR 0025); the live "changed" publisher listens. */
  changes: ChangeBus;
  /** The open live streams per person (ADR 0030). */
  live: LivePublisher;
  /** Asks Google for changes while a person has an app open; exposed so tests can see whom it watches. */
  googlePoller: GooglePoller;
  /** Web Push reminders: subscriptions, plans and the send loop (feature reminders). */
  push: PushService;
  /** Switches calendars on and off at their plans' edges. */
  planScheduler: CalendarPlanScheduler;
  /** TEST_MODE push recorder in place of the push services; null otherwise. */
  pushRecorder: RecordingSender | null;
  /** Drive double (TEST_MODE / mock provider); null with the real Google provider. */
  mockDrive: MockDrive | null;
  /** The people who signed in at least once (sharing picks members from them). */
  people: PeopleStore;
  /** Shared task lists, stored on the server (feature shared-lists). */
  shared: SharedListService;
  motivation: MotivationService;
  calendar: CalendarService;
  auth: AuthState;
  /** PROVIDER=google: builds one person's provider (one OAuth client per person). */
  personProvider?: (sub: string) => CalendarProvider;
  /** Test override for /api/config (API.md `/api/__test/config`). */
  overrides: { pollIntervalMs?: number; /** Test mode: how often Google is asked for changes while an app is open (ms). */ googlePollMs?: number; /** Test mode: the live stream's keep-alive and session check interval (ms). */ liveHeartbeatMs?: number; /** Test mode: every non-test `/api` answer waits this long (ms). */ slowMs?: number; /** Test mode: the next event or task list write answers this status and changes nothing. */ refuseNextWrite?: 400 | 404; version?: string; apk?: ApkInfo | null; notes?: ReleaseNote[]; /** Test mode: the places the stand-in place search knows (feature event-location). */ places?: TestPlace[] };
  /** Release notes parsed from CHANGELOG.md once at start. */
  releaseNotes: ReleaseNote[];
  health: { at: number; status: 'ok' | 'unavailable' } | null;
  /** The calendar of the signed-in person; the shared one when auth is off. */
  calendarFor(sub: string | null | undefined): CalendarService;
  /** Mock calendar of one person (TEST_MODE): separate data per Google account. */
  mockFor(sub: string): MockGoogleProvider;
  /** Drops one person's cached CalendarService and provider (and so their OAuth client, calendar list and tasks-calendar id) so the next request rebuilds them from the stored token. */
  forgetPerson(sub: string): void;
  /** Forgets all per-person calendars (test reset). */
  resetPeople(): void;
  seed(): Promise<void>;
  close(): void;
}

export function createContext(config: AppConfig, provider?: CalendarProvider, clock = new Clock(), personProvider?: (sub: string) => CalendarProvider, driveFor?: (sub: string) => DriveClient): Ctx {
  const mock = provider ? (provider instanceof MockGoogleProvider ? provider : null)
    : config.provider === 'mock' ? new MockGoogleProvider({ dataDir: config.dataDir, tz: config.tz, clock }) : null;
  const prov: CalendarProvider = provider ?? mock ?? (() => { throw new Error('Google provider must be passed in (see index.ts)'); })();
  const people = new PeopleStore(config.dataDir);
  // the retired server-wide settings and streak become every known person's own, once (ADR 0035)
  splitServerWideFiles(config.dataDir, knownSubs(config.dataDir, people.all().map((p) => p.sub), LOCAL_PERSON),
    (m) => { if (config.logLevel !== 'error') console.log(m); });
  const settings = new SettingsStore(config.dataDir, clock, config.tz);
  const prefs = new PrefsStore(config.dataDir);
  const themes = new ThemeStore(config.dataDir);
  const canvas = new CanvasStore(config.dataDir);
  const ink = new InkStore(config.dataDir);
  const idempotency = new IdempotencyStore(config.dataDir);
  const templates = new TemplateStore(config.dataDir);
  const motivation = new MotivationService(config.dataDir, clock, config.tz);
  const mockDrive = config.provider === 'mock' ? new MockDrive(path.join(config.dataDir, 'mock-drive.json'), clock) : null;
  const auth = new AuthState(config, () => clock.real());
  const shared = new SharedListService(config.dataDir, people, clock, config.tz, () => (auth.on ? (e: string) => auth.allows(e) : null), ink);
  const inkService = new InkService(ink, shared);
  const backup = new BackupService({
    dataDir: config.dataDir, clock, appVersion: VERSION, isOn: () => auth.on, hasPermission: (sub) => hasDriveScope(config.dataDir, sub),
    // a person taken off ALLOWED_EMAILS is no longer backed up, and a restore never brings back an unsafe theme
    isPermitted: (sub) => shared.permitted(sub), vetRestored: vetRestoredFile,
    driveFor: (sub) => (driveFor ? driveFor(sub) : mockDrive?.forPerson(sub) ?? null),
    log: (m) => { if (config.logLevel !== 'error') console.log(m); },
  });
  // TEST_MODE: pushes are recorded instead of sent over the network
  const pushRecorder = config.testMode ? new RecordingSender() : null;
  const vapid = loadVapid(config.dataDir);
  const push = new PushService({
    dataDir: config.dataDir, clock, vapidPublicKey: vapid.publicKey, isPermitted: (sub) => shared.permitted(sub), log: (m) => { if (config.logLevel !== 'error') console.log(m); },
    sender: pushRecorder ?? webPushSender(vapid, process.env.VAPID_SUBJECT ?? config.publicUrl ?? 'mailto:calendar@example.org'),
  });
  registerSharedListsBackup(backup, shared, config.dataDir);
  registerServerFilesBackup(backup, { people, shared });
  const calendar = new CalendarService(prov, settings, motivation, clock, config, prefs, LOCAL_PERSON, shared);
  if (mock) calendar.rawInsert = async (cal, ev) => mock.remote.insert(cal, ev);
  const mocks = new Map<string, MockGoogleProvider>();
  const calendars = new Map<string, CalendarService>();
  const changes = new ChangeBus();
  // a newcomer is offered in everybody's "Share with" at once, not at their next poll
  people.onNew = () => changes.emitAll(people.all().map((p) => p.sub));
  const poller = new GooglePoller({
    calendarFor: (sub) => ctx.calendarFor(sub === LOCAL_PERSON ? null : sub), today: () => motivation.today(),
    intervalMs: () => ctx.overrides.googlePollMs ?? config.googlePollMs, publish: (subs, kind) => changes.emit(subs, kind),
  });
  const live = new LivePublisher(changes, { maxPerPerson: 10, onFirst: (sub) => poller.start(sub), onLast: (sub) => poller.stop(sub) });
  const ctx: Ctx = {
    config, clock, changes, live, googlePoller: poller, provider: prov, mock, settings, prefs, themes, canvas, ink, inks: inkService, idempotency, templates, backup, push, planScheduler: new CalendarPlanScheduler({ dataDir: config.dataDir, clock, tz: config.tz, prefs, changes }), pushRecorder, mockDrive, people, shared, motivation, calendar, overrides: {}, releaseNotes: loadReleaseNotes(config.changelogPath), health: null, personProvider, auth,
    mockFor(sub) {
      let m = mocks.get(sub);
      if (!m) mocks.set(sub, (m = new MockGoogleProvider({ dataDir: null, tz: config.tz, clock })));
      return m;
    },
    calendarFor(sub) {
      if (!ctx.auth.on || !sub) return calendar;
      let c = calendars.get(sub);
      if (!c) {
        // google: one provider per person; mock: one calendar per person; tests with an injected provider share it
        const p = personProvider ? personProvider(sub) : mock ? ctx.mockFor(sub) : null;
        if (!p) return calendar;
        calendars.set(sub, (c = new CalendarService(p, settings, motivation, clock, config, prefs, sub, shared)));
      }
      return c;
    },
    forgetPerson(sub) {
      calendars.delete(sub);
    },
    resetPeople() {
      calendars.clear();
      mocks.clear();
    },
    async seed() {
      await seedDemo(calendar, motivation, clock.nowMs(), config.tz);
    },
    close() {
      live.closeAll();
      backup.close();
      push.close(); ctx.planScheduler.close();
      mock?.close();
    },
  };
  return ctx;
}

