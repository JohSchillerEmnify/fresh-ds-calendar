import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';

/** Case-insensitive allow-list check (Google addresses are case-insensitive for our purposes). */
export function isAllowed(email: string, allowed: readonly string[]): boolean {
  const e = email.trim().toLowerCase();
  return e !== '' && allowed.some((a) => a.trim().toLowerCase() === e);
}

/** Parses a comma-separated address list into a lower-cased, de-duplicated array. */
export function parseEmails(v: string | undefined): string[] {
  return [...new Set((v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

/** Stable per-person id for the OAuth test double and the per-person mock calendars (Google's `sub` stand-in). */
export const mockSub = (email: string): string => `mock-${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16)}`;

/** `DATA_DIR/users/<sub>/`. The sub ends up in a path, so anything but a plain id is refused. */
export function userDir(dataDir: string, sub: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(sub)) throw new Error('Invalid user id');
  return path.join(dataDir, 'users', sub);
}

export const userTokenFile = (dataDir: string, sub: string): string => path.join(userDir(dataDir, sub), 'google-token.json');
const legacyTokenFile = (dataDir: string): string => path.join(dataDir, 'google-token.json');

export function readUserToken(dataDir: string, sub: string): string | null {
  return readJson<{ refresh_token?: string }>(userTokenFile(dataDir, sub))?.refresh_token ?? null;
}

export function writeUserToken(dataDir: string, sub: string, refreshToken: string): void {
  writeJsonAtomic(userTokenFile(dataDir, sub), { refresh_token: refreshToken }, 0o600);
}

/**
 * Moves the pre-sign-in single-user token (`DATA_DIR/google-token.json`) to `sub` when nobody has a token yet,
 * so the first person to sign in inherits it. Returns the migrated refresh token or null.
 */
export function claimLegacyToken(dataDir: string, sub: string): string | null {
  const legacy = legacyTokenFile(dataDir);
  const rt = readJson<{ refresh_token?: string }>(legacy)?.refresh_token;
  if (!rt) return null;
  const users = path.join(dataDir, 'users');
  const anyone = fs.existsSync(users) && fs.readdirSync(users).some((u) => fs.existsSync(path.join(users, u, 'google-token.json')));
  if (anyone) return null;
  writeUserToken(dataDir, sub, rt);
  fs.rmSync(legacy, { force: true });
  return rt;
}
