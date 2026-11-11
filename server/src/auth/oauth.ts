import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { CALENDAR_SCOPE, CONTACTS_SCOPE, DRIVE_APPDATA_SCOPE, mockSub } from './people.js';

/** What the callback needs from one OAuth round trip: who signed in and the long-lived calendar token. */
export interface OAuthResult {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  refreshToken: string | null;
  /** Scopes Google granted (space-separated, from the token response); null when Google did not say. */
  scope: string | null;
}

/** The Google side of sign-in: the real one lives in providers/google/auth.ts, the test double below. */
export interface OAuthBackend {
  /** `contacts`: also ask for read access to the person's contacts (an incremental grant on top of what was granted before). */
  authUrl(state: string, contacts?: boolean): string;
  exchange(code: string): Promise<OAuthResult>;
}

/** Where a round trip returns to: the calendar, or (a Contacts grant started in the settings) the Birthdays settings page. */
export const returnTarget = (issued: { contacts: boolean; settings: boolean }): string => (issued.contacts && issued.settings ? '/settings/calendars/birthdays' : '/');

const STATE_TTL_MS = 10 * 60_000;

/**
 * Stateless OAuth `state` values for the redirect (CSRF protection together with the state cookie). A state is
 * `<payload>.<signature>`: the payload holds a random nonce, the app flag and the expiry, the signature is an
 * HMAC-SHA256 with a key derived from the Google client secret (a random per-process key without one, as in TEST_MODE).
 * Nothing is kept in memory, so flooding `/api/auth/google/start` cannot push a real sign-in's state out.
 */
export class StateStore {
  private readonly key: Buffer;

  constructor(private readonly now: () => number, clientSecret: string | null = null) {
    this.key = clientSecret ? createHmac('sha256', clientSecret).update('cal-oauth-state').digest() : randomBytes(32);
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }

  /** Issues a state; `app` = Android app round trip, `contacts` = asks for the Contacts permission, `settings` = returns to the settings. */
  create(app = false, contacts = false, settings = false): string {
    const payload = Buffer.from(JSON.stringify({ n: randomBytes(16).toString('hex'), app, ...(contacts ? { contacts, settings } : {}), exp: this.now() + STATE_TTL_MS })).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  /** Verifies a state: what it was issued with for one we signed that has not expired, null for a forged, malformed or expired one. */
  consume(state: string): { app: boolean; contacts: boolean; settings: boolean } | null {
    const [payload, sig, ...rest] = state.split('.');
    if (!payload || !sig || rest.length) return null;
    const want = Buffer.from(this.sign(payload));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    try {
      const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { app?: unknown; contacts?: unknown; settings?: unknown; exp?: unknown };
      return typeof d.exp === 'number' && this.now() <= d.exp ? { app: d.app === true, contacts: d.contacts === true, settings: d.settings === true } : null;
    } catch {
      return null;
    }
  }

  /** Nothing is stored, so there is nothing to clear (kept for {@link AuthState.reset}). */
  clear(): void {}
}

/**
 * OAuth test double (TEST_MODE with the mock provider only). "Consent" is a test route that signs in whichever
 * account the test chose; the code it issues carries the address, which `exchange` turns back into an identity.
 */
export class FakeOAuth implements OAuthBackend {
  /** The Google account the next consent screen "picks". */
  account: string | null = null;
  /** Whether the next consent grants the Drive app-folder permission. */
  driveScope = true;
  /** False: the fake consent screen is answered without the calendar scope (the person left the checkbox unticked). */
  calendarGranted = true;
  /** Whether the consent adds `contacts.readonly` (on by default); for the signed-out person this is the grant. */
  contactsScope = true;

  authUrl(state: string): string {
    return `/api/__test/oauth/consent?state=${encodeURIComponent(state)}`;
  }

  codeFor(email: string): string {
    return `fake:${encodeURIComponent(email)}`;
  }

  async exchange(code: string): Promise<OAuthResult> {
    if (!code.startsWith('fake:')) throw new Error('Invalid fake code');
    const email = decodeURIComponent(code.slice(5)).toLowerCase();
    const scope = ['openid', 'email', ...(this.calendarGranted ? [CALENDAR_SCOPE] : []), ...(this.driveScope ? [DRIVE_APPDATA_SCOPE] : []), ...(this.contactsScope ? [CONTACTS_SCOPE] : [])].join(' ');
    return { sub: mockSub(email), email, emailVerified: true, name: email.split('@')[0] ?? email, refreshToken: `fake-refresh-${mockSub(email)}`, scope };
  }
}
