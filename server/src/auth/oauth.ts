import { randomBytes } from 'node:crypto';
import { CALENDAR_SCOPE, mockSub } from './people.js';

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
  authUrl(state: string): string;
  exchange(code: string): Promise<OAuthResult>;
}

const STATE_TTL_MS = 10 * 60_000;

/** Single-use, short-lived `state` values for the OAuth redirect (CSRF protection together with the state cookie). */
export class StateStore {
  private states = new Map<string, number>();

  constructor(private readonly now: () => number) {}

  create(): string {
    const state = randomBytes(16).toString('hex');
    const t = this.now();
    for (const [s, at] of this.states) if (t - at > STATE_TTL_MS) this.states.delete(s);
    if (this.states.size > 50) this.states.delete(this.states.keys().next().value!);
    this.states.set(state, t);
    return state;
  }

  consume(state: string): boolean {
    const at = this.states.get(state);
    this.states.delete(state);
    return at !== undefined && this.now() - at <= STATE_TTL_MS;
  }

  clear(): void {
    this.states.clear();
  }
}

/**
 * OAuth test double (TEST_MODE with the mock provider only). "Consent" is a test route that signs in whichever
 * account the test chose; the code it issues carries the address, which `exchange` turns back into an identity.
 */
export class FakeOAuth implements OAuthBackend {
  /** The Google account the next consent screen "picks". */
  account: string | null = null;
  /** False: the fake consent screen is answered without the calendar scope (the person left the checkbox unticked). */
  calendarGranted = true;

  authUrl(state: string): string {
    return `/api/__test/oauth/consent?state=${encodeURIComponent(state)}`;
  }

  codeFor(email: string): string {
    return `fake:${encodeURIComponent(email)}`;
  }

  async exchange(code: string): Promise<OAuthResult> {
    if (!code.startsWith('fake:')) throw new Error('Invalid fake code');
    const email = decodeURIComponent(code.slice(5)).toLowerCase();
    return { sub: mockSub(email), email, emailVerified: true, name: email.split('@')[0] ?? email, refreshToken: `fake-refresh-${mockSub(email)}`, scope: this.calendarGranted ? `openid email ${CALENDAR_SCOPE}` : 'openid email' };
  }
}
