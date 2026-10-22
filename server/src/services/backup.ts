/**
 * Pure helpers of the Google Drive backup (feature drive-backup): the bundle format, path rules, retention and
 * the debounce arithmetic. No I/O here, so everything is unit-testable; the orchestration is in `backupService.ts`.
 */
import { createHash } from 'node:crypto';
import type { DriveFile } from '../providers/DriveClient.js';

export const BACKUP_SCHEMA = 1;
/** How many backup versions are kept per person. */
export const BACKUP_KEEP = 7;
/** Files of a person that never go into a backup (a secret, the bookkeeping of the backup itself, and the browsers' push subscriptions with their plans). */
export const EXCLUDED_FILES: readonly string[] = ['google-token.json', 'backup-state.json', 'push.json'];

/** One backup: every file of a person as UTF-8 text, keyed by its path relative to `DATA_DIR`. */
export interface BackupBundle {
  schema: number;
  /** RFC 3339 instant the backup was made. */
  created: string;
  appVersion: string;
  sub: string;
  files: Record<string, string>;
}

/** The bundle is unreadable, from a newer app, or tries to write where it must not. */
export class BackupFormatError extends Error {}

/** Name prefix of all backups of one person. */
export const backupPrefix = (sub: string): string => `backup-${sub}-`;

/** `backup-<sub>-<UTC timestamp>.json`, e.g. `backup-abc-20261012T080000123Z.json`. */
export function backupName(sub: string, createdMs: number): string {
  return `${backupPrefix(sub)}${new Date(createdMs).toISOString().replace(/[-:.]/g, '')}.json`;
}

/** Whether `rel` is a plain relative path with no `..`, backslash, NUL or empty segment. */
export function isSafeRelPath(rel: string): boolean {
  if (!rel || rel.startsWith('/') || rel.includes('\\') || rel.includes('\0')) return false;
  return rel.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/** True for the person's own files that stay out of every backup and are never overwritten by a restore. */
export const isExcluded = (rel: string, sub: string): boolean => EXCLUDED_FILES.some((f) => rel === `users/${sub}/${f}`);

/** Whether a restore may write `rel`: inside the person's folder or a registered prefix, and not an excluded file. */
export function isRestorable(rel: string, sub: string, prefixes: readonly string[]): boolean {
  if (!isSafeRelPath(rel) || isExcluded(rel, sub)) return false;
  return rel.startsWith(`users/${sub}/`) || prefixes.some((p) => rel.startsWith(`${p}/`));
}

/** Builds the document that is uploaded. */
export function bundle(files: Record<string, string>, meta: { sub: string; createdMs: number; appVersion: string }): BackupBundle {
  return { schema: BACKUP_SCHEMA, created: new Date(meta.createdMs).toISOString(), appVersion: meta.appVersion, sub: meta.sub, files };
}

/** Parses and validates a downloaded bundle for `sub`; throws {@link BackupFormatError} for anything unusable. */
export function unbundle(text: string, sub: string, prefixes: readonly string[]): BackupBundle {
  let d: Partial<BackupBundle>;
  try {
    d = JSON.parse(text) as Partial<BackupBundle>;
  } catch {
    throw new BackupFormatError('Backup is not valid JSON');
  }
  if (typeof d !== 'object' || d === null) throw new BackupFormatError('Backup is not an object');
  if (d.schema !== BACKUP_SCHEMA) throw new BackupFormatError(`Unknown backup schema ${String(d.schema)}`);
  if (d.sub !== sub) throw new BackupFormatError('Backup belongs to another person');
  if (typeof d.created !== 'string' || Number.isNaN(Date.parse(d.created))) throw new BackupFormatError('Backup has no valid created time');
  if (typeof d.files !== 'object' || d.files === null || Array.isArray(d.files)) throw new BackupFormatError('Backup has no files');
  for (const [rel, content] of Object.entries(d.files)) {
    if (typeof content !== 'string') throw new BackupFormatError(`File ${rel} is not text`);
    if (!isRestorable(rel, sub, prefixes)) throw new BackupFormatError(`File ${rel} may not be restored`);
  }
  return { schema: BACKUP_SCHEMA, created: d.created, appVersion: typeof d.appVersion === 'string' ? d.appVersion : '', sub, files: d.files as Record<string, string> };
}

/** SHA-256 of the files (sorted by path), to tell "nothing changed" without storing the content. */
export function contentHash(files: Record<string, string>): string {
  const h = createHash('sha256');
  for (const k of Object.keys(files).sort()) h.update(`${k}\0${files[k]}\0`);
  return h.digest('hex');
}

/** Newest first; equal times fall back to the id so the order is stable. */
export function newestFirst<T extends DriveFile>(files: readonly T[]): T[] {
  return [...files].sort((a, b) => (a.createdTime === b.createdTime ? (a.id < b.id ? 1 : -1) : a.createdTime < b.createdTime ? 1 : -1));
}

/** The versions beyond the newest `keep`; these are deleted after a successful upload. */
export function selectExpired<T extends DriveFile>(files: readonly T[], keep: number): T[] {
  return newestFirst(files).slice(Math.max(0, keep));
}

/**
 * Milliseconds until the next automatic backup after a change: 2 minutes after the last change, but at least
 * 5 minutes after the previous backup (`lastRun` is null when there was none).
 */
export function debounceDelay(o: { now: number; lastChange: number; lastRun: number | null; debounceMs: number; minIntervalMs: number }): number {
  const at = Math.max(o.lastChange + o.debounceMs, o.lastRun === null ? -Infinity : o.lastRun + o.minIntervalMs);
  return Math.max(0, at - o.now);
}
