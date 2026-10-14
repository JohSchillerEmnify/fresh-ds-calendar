import path from 'node:path';
import type { AppConfig } from '../config.js';
import { isAllowed } from './people.js';
import { FakeOAuth, StateStore, type OAuthBackend } from './oauth.js';
import { SessionStore } from './sessions.js';
import { ExchangeStore } from './appExchange.js';

/**
 * Sign-in state of the process. Auth is on with PROVIDER=google and off with PROVIDER=mock; in TEST_MODE a test
 * endpoint can switch it on with an allow-list (and `reset()` switches it back).
 */
export class AuthState {
  on: boolean;
  allowedEmails: string[];
  readonly sessions: SessionStore;
  readonly states: StateStore;
  /** One-time codes that hand an app sign-in's session from the system browser to the app's WebView. */
  readonly exchanges: ExchangeStore;
  /** Set for the TEST_MODE + mock combination only. */
  readonly fake: FakeOAuth | null;
  /** The real Google backend, built lazily (the Google libraries load only with PROVIDER=google). */
  google: OAuthBackend | null = null;

  constructor(private readonly config: AppConfig, now: () => number) {
    this.on = config.provider === 'google';
    this.allowedEmails = [...config.allowedEmails];
    this.sessions = new SessionStore(path.join(config.dataDir, 'sessions.json'), now);
    this.states = new StateStore(now);
    this.exchanges = new ExchangeStore(now);
    this.fake = config.testMode && config.provider === 'mock' ? new FakeOAuth() : null;
  }

  allows(email: string): boolean {
    return isAllowed(email, this.allowedEmails);
  }

  /** Back to the configured state (used by `/api/__test/reset`). */
  reset(): void {
    this.on = this.config.provider === 'google';
    this.allowedEmails = [...this.config.allowedEmails];
    this.sessions.clear();
    this.states.clear();
    this.exchanges.clear();
    if (this.fake) {
      this.fake.account = null;
      this.fake.driveScope = true;
      this.fake.calendarGranted = true;
    }
  }
}
