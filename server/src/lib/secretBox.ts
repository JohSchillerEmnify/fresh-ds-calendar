/**
 * AES-256-GCM envelope for secrets at rest (ADR 0026). A sealed value is
 * `{ v: 1, alg: "A256GCM", iv, tag, ct }` (base64); the key is 32 bytes, base64, from `TOKEN_ENC_KEY`.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** The on-disk shape of a sealed value. */
export interface Envelope { v: 1; alg: 'A256GCM'; iv: string; tag: string; ct: string }

/** True when `key` is base64 for exactly 32 bytes. */
export const validKey = (key: string | undefined): key is string => !!key && Buffer.from(key, 'base64').length === 32;

/** True when a parsed JSON value looks like an {@link Envelope}. */
export const isEnvelope = (v: unknown): v is Envelope => {
  const e = v as Partial<Envelope> | null;
  return !!e && typeof e === 'object' && e.v === 1 && e.alg === 'A256GCM' && typeof e.iv === 'string' && typeof e.tag === 'string' && typeof e.ct === 'string';
};

/** Encrypts a JSON value with a fresh random 12-byte IV. */
export function seal(value: unknown, key: string): Envelope {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return { v: 1, alg: 'A256GCM', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}

/** Decrypts an envelope; null for a wrong key, a tampered file or a bad key. Never throws. */
export function open(env: Envelope, key: string | undefined): unknown {
  if (!validKey(key)) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(env.iv, 'base64'));
    d.setAuthTag(Buffer.from(env.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(env.ct, 'base64')), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}
