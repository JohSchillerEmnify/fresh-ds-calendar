import { OAuth2Client } from 'google-auth-library';
import type { AppConfig } from '../../config.js';
import type { OAuthBackend, OAuthResult } from '../../auth/oauth.js';
import { CONTACTS_SCOPE, DRIVE_APPDATA_SCOPE, hasCalendarScope, readUserScope, readUserToken, writeUserToken } from '../../auth/people.js';

/** One OAuth round trip signs in (`openid email`), connects the calendar and the hidden Drive app folder (backups). */
export const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar', DRIVE_APPDATA_SCOPE];
type Cfg = Pick<AppConfig, 'dataDir' | 'google'>;

/** Every call to Google (token, calendar, Drive) gives up after this long, so a stuck connection cannot hold a request or a backup forever. */
export const GOOGLE_TIMEOUT_MS = 30_000;

const newClient = (config: Cfg) =>
  new OAuth2Client({
    clientId: config.google.clientId ?? undefined, clientSecret: config.google.clientSecret ?? undefined, redirectUri: config.google.redirectUri ?? undefined,
    transporterOptions: { timeout: GOOGLE_TIMEOUT_MS },
  });

const clients = new Map<string, OAuth2Client>();

/** One OAuth client per person (cached), seeded with that person's stored refresh token. */
export function getUserClient(config: Cfg, sub: string): OAuth2Client {
  const k = `${config.dataDir}\u0000${sub}`;
  let c = clients.get(k);
  if (!c) {
    c = newClient(config);
    const rt = readUserToken(config.dataDir, sub);
    if (rt) c.setCredentials({ refresh_token: rt });
    clients.set(k, c);
  }
  return c;
}

/** Stores a person's refresh token and granted scopes (0600) and drops the cached client so the next call uses it. */
export function storeUserToken(config: Cfg, sub: string, refreshToken: string, scope?: string | null): void {
  writeUserToken(config.dataDir, sub, refreshToken, scope);
  clients.delete(`${config.dataDir}\u0000${sub}`);
}

/** True only when the stored grant is known to lack the calendar scope (tokens without a recorded scope are judged by Google's answer). */
export const calendarScopeMissing = (config: Cfg, sub: string): boolean => {
  const scope = readUserScope(config.dataDir, sub);
  return scope !== null && !hasCalendarScope(scope);
};

export const hasUserToken = (config: Cfg, sub: string): boolean => readUserToken(config.dataDir, sub) !== null;

/** The real Google side of sign-in. */
export class GoogleOAuth implements OAuthBackend {
  constructor(private readonly config: Cfg) {}

  authUrl(state: string, contacts = false): string {
    return newClient(this.config).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: contacts ? [...SCOPES, CONTACTS_SCOPE] : SCOPES, state, include_granted_scopes: true });
  }

  async exchange(code: string): Promise<OAuthResult> {
    const client = newClient(this.config);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new Error('Google did not return an id_token');
    const payload = (await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.google.clientId ?? undefined })).getPayload();
    if (!payload?.sub || !payload.email) throw new Error('Google id_token has no email');
    return { sub: payload.sub, email: payload.email, emailVerified: payload.email_verified === true, name: payload.name ?? null, refreshToken: tokens.refresh_token ?? null, scope: tokens.scope ?? null };
  }
}
