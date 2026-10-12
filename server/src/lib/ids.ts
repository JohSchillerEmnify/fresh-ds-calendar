import { createHash, randomBytes } from 'node:crypto';

const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const BASE32HEX = '0123456789abcdefghijklmnopqrstuv';

/** nanoid-style id, `[A-Za-z0-9_-]{size}` (64-char alphabet, so no modulo bias). */
export function nanoid(size = 8): string {
  const bytes = randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i++) out += URL_ALPHABET[bytes[i]! & 63];
  return out;
}

/** Google event id: base32hex `[a-v0-9]`, 26 chars. */
export function googleEventId(): string {
  const bytes = randomBytes(26);
  let out = '';
  for (let i = 0; i < 26; i++) out += BASE32HEX[bytes[i]! & 31];
  return out;
}

export const GOOGLE_EVENT_ID_RE = /^[a-v0-9]{5,1024}$/;

/** Stable 8-char item id derived from text (used for items parsed from a description). */
export function stableId(text: string): string {
  return createHash('sha1').update(text).digest('base64url').slice(0, 8);
}
