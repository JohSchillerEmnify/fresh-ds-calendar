import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import type { AppConfig } from '../../config.js';
import { readJson, writeJsonAtomic } from '../../lib/atomicJson.js';

export const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const clients = new Map<string, OAuth2Client>();
const states = new Map<string, number>();
const STATE_TTL_MS = 10 * 60_000;

export const tokenFile = (config: Pick<AppConfig, 'dataDir'>) => path.join(config.dataDir, 'google-token.json');

export function storedRefreshToken(config: Pick<AppConfig, 'dataDir' | 'google'>): string | null {
  return config.google.refreshToken ?? readJson<{ refresh_token?: string }>(tokenFile(config))?.refresh_token ?? null;
}

export function hasStoredToken(config: Pick<AppConfig, 'dataDir' | 'google'>): boolean {
  return storedRefreshToken(config) !== null;
}

/** One shared OAuth client per process so a token obtained via the callback is used immediately. */
export function getClient(config: Pick<AppConfig, 'dataDir' | 'google'>): OAuth2Client {
  const k = config.dataDir;
  let c = clients.get(k);
  if (!c) {
    c = new OAuth2Client({ clientId: config.google.clientId ?? undefined, clientSecret: config.google.clientSecret ?? undefined, redirectUri: config.google.redirectUri ?? undefined });
    const rt = storedRefreshToken(config);
    if (rt) c.setCredentials({ refresh_token: rt });
    clients.set(k, c);
  }
  return c;
}

export function startUrl(config: Pick<AppConfig, 'dataDir' | 'google'>): string {
  const state = randomBytes(16).toString('hex');
  const now = Date.now();
  for (const [s, t] of states) if (now - t > STATE_TTL_MS) states.delete(s);
  if (states.size > 50) states.delete(states.keys().next().value!);
  states.set(state, now);
  return getClient(config).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state });
}

export function consumeState(state: string): boolean {
  const t = states.get(state);
  states.delete(state);
  return t !== undefined && Date.now() - t <= STATE_TTL_MS;
}

export async function exchangeAndStore(config: Pick<AppConfig, 'dataDir' | 'google'>, code: string): Promise<void> {
  const client = getClient(config);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google did not return a refresh token (revoke access and retry)');
  client.setCredentials(tokens);
  fs.mkdirSync(config.dataDir, { recursive: true });
  writeJsonAtomic(tokenFile(config), { refresh_token: tokens.refresh_token }, 0o600);
}
