/**
 * Orchestration of the Google Drive backup (ARCHITECTURE "Backups"): collects a person's files, uploads versions,
 * keeps the newest ones, restores, and runs the debounce and daily timers. The pure parts are in `backup.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Clock } from '../lib/clock.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { listUserSubs, userDir } from '../auth/people.js';
import { subHash } from '../lib/diag.js';
import { DriveError, type DriveClient } from '../providers/DriveClient.js';
import {
  BACKUP_KEEP, backupName, backupPrefix, bundle, contentHash, debounceDelay, isExcluded, isSafeRelPath, newestFirst, selectExpired, unbundle,
  type BackupBundle,
} from './backup.js';

/** A store that keeps per-person files outside `users/<sub>/` (e.g. shared lists) and wants them in the backup. */
export interface BackupSource {
  /** Top-level folder under `DATA_DIR` the source owns, e.g. `shared`; restore may write only below it. */
  prefix: string;
  /** The person's files of this source as `{ 'shared/lists/x.json': content }`. */
  collect(sub: string): Record<string, string>;
  /**
   * Restores this source's files of the bundle (all keys start with `prefix/`). Without it the files are written back
   * as they are; a source that must not overwrite everything (shared lists: only what the person owns) provides it.
   */
  restore?(sub: string, files: Record<string, string>): void;
  /** Called after this source's files were restored, so the store re-reads them from disk. */
  reload?(): void;
}

/** Largest single file a backup carries, in bytes; a bigger one is left out (a hostile or runaway file must not bloat every backup). */
export const MAX_BACKUP_FILE_BYTES = 2 * 1024 * 1024;

/** The text a person sees for a failed backup: Drive's own answer and the backup's own messages, never file paths or stack text. */
const publicMessage = (e: unknown): string => (e instanceof BackupError || e instanceof DriveError ? e.message : 'The backup failed');

/** A server-wide file (not owned by one person) that goes into every bundle under `server/<rel>`. */
export interface ServerFile {
  /** Path relative to `DATA_DIR`, e.g. `settings.json`. */
  rel: string;
  /** Whether the server's current content (null = no file) is still untouched, i.e. nothing is lost by replacing it. */
  pristine(content: string | null, sub: string): boolean;
  /** Called after the file was restored, so the store re-reads it. */
  reload?(): void;
  /** Cuts the file down to what this person may carry in their backup (null: leave the file out). */
  collect?(content: string, sub: string): string | null;
}

/** What Settings shows (API.md "Backups"). */
export interface BackupStatus {
  available: boolean;
  permission: 'granted' | 'missing';
  state: 'off' | 'never' | 'ok' | 'failed';
  lastBackupAt: string | null;
  error: string | null;
  keep: number;
}

/** `PERMISSION`: no Drive scope. `NO_BACKUP`: Drive holds none. `FAILED`: Drive or the files failed. */
export class BackupError extends Error {
  constructor(readonly code: 'PERMISSION' | 'NO_BACKUP' | 'FAILED', message: string) {
    super(message);
  }
}

/** The bookkeeping kept per person in `users/<sub>/backup-state.json` (never part of a backup). */
interface State { lastBackupAt?: string; lastHash?: string; error?: string; errorAt?: string; restorePending?: boolean }

/** The tunable timings (hooks in TEST_MODE change them). */
export interface BackupTimings { keep: number; debounceMs: number; minIntervalMs: number; dailyMs: number; checkEveryMs: number }
/** Bundle prefix of the server-wide files. */
export const SERVER_PREFIX = 'server';
export const DEFAULT_TIMINGS: BackupTimings = { keep: BACKUP_KEEP, debounceMs: 2 * 60_000, minIntervalMs: 5 * 60_000, dailyMs: 24 * 3_600_000, checkEveryMs: 3_600_000 };

export interface BackupDeps {
  dataDir: string;
  clock: Clock;
  appVersion: string;
  /** Backups need a Google account: false while sign-in is off. */
  isOn(): boolean;
  /** The person's hidden Drive folder, or null when this server has no Drive. */
  driveFor(sub: string): DriveClient | null;
  /** Whether the person's token has the Drive app-folder scope. */
  hasPermission(sub: string): boolean;
  /** False for a person taken off the allow-list: no automatic backup for them. Default: everybody. */
  isPermitted?(sub: string): boolean;
  /** Re-checks an own file before a restore writes it: the text to write, or null to skip it. Default: as it is. */
  vetRestored?(rel: string, content: string): Promise<string | null>;
  log?(message: string): void;
}

/** Backs up and restores the data of one person per Google account. */
export class BackupService {
  readonly timings: BackupTimings = { ...DEFAULT_TIMINGS };
  private readonly sources: BackupSource[] = [];
  private readonly serverFiles: ServerFile[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly lastChange = new Map<string, number>();
  private readonly lastRun = new Map<string, number>();
  private readonly queue = new Map<string, Promise<unknown>>();
  private interval: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  constructor(private readonly d: BackupDeps) {}

  private log(m: string): void {
    this.d.log?.(m);
  }

  /** Adds the files of another store to every person's backup (the one line a new store needs). */
  registerSource(source: BackupSource): void {
    if (!/^[A-Za-z0-9_-]+$/.test(source.prefix) || source.prefix === 'users' || source.prefix === SERVER_PREFIX) throw new Error(`Invalid backup prefix: ${source.prefix}`);
    this.sources.push(source);
  }

  /** Adds a server-wide file to every bundle; restored only onto a fresh server (see {@link ServerFile}). */
  registerServerFile(f: ServerFile): void {
    this.serverFiles.push(f);
  }

  private get prefixes(): string[] {
    return [...this.sources.map((s) => s.prefix), SERVER_PREFIX];
  }

  private readServer(f: ServerFile): string | null {
    try {
      return fs.readFileSync(path.join(this.d.dataDir, ...f.rel.split('/')), 'utf8');
    } catch {
      return null;
    }
  }

  // ---- state file ----------------------------------------------------------

  private stateFile(sub: string): string {
    return path.join(userDir(this.d.dataDir, sub), 'backup-state.json');
  }

  private state(sub: string): State {
    return readJson<State>(this.stateFile(sub)) ?? {};
  }

  private setState(sub: string, patch: (s: State) => void): void {
    const s = this.state(sub);
    patch(s);
    writeJsonAtomic(this.stateFile(sub), s);
  }

  /** What Settings shows; reads the state file only and never calls Drive. */
  status(sub: string): BackupStatus {
    const keep = this.timings.keep;
    if (!this.d.isOn()) return { available: false, permission: 'missing', state: 'off', lastBackupAt: null, error: null, keep };
    const s = this.state(sub);
    if (!this.d.hasPermission(sub)) return { available: true, permission: 'missing', state: 'off', lastBackupAt: null, error: null, keep };
    const state = s.error ? 'failed' : s.lastBackupAt ? 'ok' : 'never';
    return { available: true, permission: 'granted', state, lastBackupAt: s.lastBackupAt ?? null, error: s.error ?? null, keep };
  }

  // ---- collecting and applying files ---------------------------------------

  /** Every file of the person (and of the registered sources) as relative path -> text. */
  collect(sub: string): Record<string, string> {
    const files: Record<string, string> = {};
    const root = userDir(this.d.dataDir, sub);
    const walk = (dir: string): void => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        const rel = path.relative(this.d.dataDir, abs).split(path.sep).join('/');
        if (e.isDirectory()) walk(abs);
        else if (e.isFile() && !isExcluded(rel, sub) && !e.name.endsWith('.tmp')) {
          if (fs.statSync(abs).size > MAX_BACKUP_FILE_BYTES) this.log(`backup: leaving out an oversized file of ${subHash(sub)}`);
          else files[rel] = fs.readFileSync(abs, 'utf8');
        }
      }
    };
    walk(root);
    for (const src of this.sources) {
      for (const [rel, content] of Object.entries(src.collect(sub))) {
        if (!isSafeRelPath(rel) || !rel.startsWith(`${src.prefix}/`)) this.log(`backup: ignoring ${rel} from source ${src.prefix} (outside its prefix)`);
        else if (content.length > MAX_BACKUP_FILE_BYTES) this.log(`backup: leaving out an oversized file of source ${src.prefix}`);
        else files[rel] = content;
      }
    }
    for (const f of this.serverFiles) {
      const raw = this.readServer(f);
      const content = raw !== null && f.collect ? f.collect(raw, sub) : raw;
      if (content !== null && content.length <= MAX_BACKUP_FILE_BYTES) files[`${SERVER_PREFIX}/${f.rel}`] = content;
    }
    return files;
  }

  /** Whether the person has data of their own (shared files alone do not count). */
  private hasData(sub: string, files = this.collect(sub)): boolean {
    return Object.keys(files).some((k) => k.startsWith(`users/${sub}/`));
  }

  /** Replaces the person's files with the bundle's (the excluded files stay). */
  private async apply(sub: string, b: BackupBundle): Promise<void> {
    const root = userDir(this.d.dataDir, sub);
    if (fs.existsSync(root)) {
      for (const e of fs.readdirSync(root)) if (!isExcluded(`users/${sub}/${e}`, sub)) fs.rmSync(path.join(root, e), { recursive: true, force: true });
    }
    const own: Record<string, string> = {};
    for (const [rel, content] of Object.entries(b.files)) {
      if (rel.startsWith(`${SERVER_PREFIX}/`)) continue;
      const src = this.sources.find((s) => rel.startsWith(`${s.prefix}/`));
      if (src?.restore) continue;
      own[rel] = content;
    }
    for (const src of this.sources) {
      if (!src.restore) continue;
      const mine = Object.fromEntries(Object.entries(b.files).filter(([rel]) => rel.startsWith(`${src.prefix}/`)));
      if (Object.keys(mine).length) src.restore(sub, mine);
    }
    // server-wide files only come back onto a fresh server, never over what other people already use
    const wanted = this.serverFiles.filter((f) => typeof b.files[`${SERVER_PREFIX}/${f.rel}`] === 'string');
    if (wanted.length && this.serverFiles.every((f) => f.pristine(this.readServer(f), sub))) {
      for (const f of wanted) this.writeFile(path.join(this.d.dataDir, ...f.rel.split('/')), b.files[`${SERVER_PREFIX}/${f.rel}`]!);
      for (const f of wanted) f.reload?.();
    }
    for (const [rel, content] of Object.entries(own)) {
      const vetted = this.d.vetRestored ? await this.d.vetRestored(rel, content) : content;
      if (vetted === null) this.log(`backup: skipped an unsafe file while restoring ${subHash(sub)}`);
      else this.writeFile(path.join(this.d.dataDir, ...rel.split('/')), vetted);
    }
    for (const src of this.sources) if (src.reload && Object.keys(b.files).some((k) => k.startsWith(`${src.prefix}/`))) src.reload();
  }

  private writeFile(abs: string, content: string): void {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = `${abs}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, abs);
  }

  // ---- Drive ----------------------------------------------------------------

  private drive(sub: string): DriveClient {
    if (!this.d.hasPermission(sub)) throw new BackupError('PERMISSION', 'Backups to Google Drive are not allowed yet');
    const drive = this.d.driveFor(sub);
    if (!drive) throw new BackupError('FAILED', 'This server has no Google Drive access');
    return drive;
  }

  /** Runs `fn` after the person's earlier runs, so two backups or a backup and a restore never overlap. */
  private serial<T>(sub: string, fn: () => Promise<T>): Promise<T> {
    const run = (this.queue.get(sub) ?? Promise.resolve()).then(fn, fn);
    this.queue.set(sub, run.catch(() => undefined));
    return run;
  }

  /** Uploads one version and deletes the ones beyond `keep`. 'skipped' when there is nothing (new) to save. */
  private async backupInner(sub: string, force: boolean): Promise<'done' | 'skipped'> {
    const drive = this.drive(sub);
    try {
      if (this.state(sub).restorePending) await this.autoRestoreInner(sub, drive);
      const files = this.collect(sub);
      if (!this.hasData(sub, files)) return 'skipped';
      const hash = contentHash(files);
      const s = this.state(sub);
      if (!force && hash === s.lastHash && !s.error) return 'skipped';
      const createdMs = this.d.clock.nowMs();
      await drive.create(backupName(sub, createdMs), JSON.stringify(bundle(files, { sub, createdMs, appVersion: this.d.appVersion })));
      this.lastRun.set(sub, this.d.clock.real());
      this.setState(sub, (x) => { x.lastBackupAt = new Date(createdMs).toISOString(); x.lastHash = hash; delete x.error; delete x.errorAt; });
      try {
        // a failed delete only leaves an old version around until the next backup
        for (const f of selectExpired(await drive.list(backupPrefix(sub)), this.timings.keep)) await drive.delete(f.id);
      } catch (e) {
        this.log(`backup: could not delete old versions of ${subHash(sub)}: ${(e as Error).message}`);
      }
      return 'done';
    } catch (e) {
      // the person sees a safe message; the full text stays in the log
      const message = publicMessage(e);
      this.log(`backup failed for ${subHash(sub)}: ${e instanceof Error ? e.message : String(e)}`);
      this.setState(sub, (x) => { x.error = message; x.errorAt = new Date(this.d.clock.nowMs()).toISOString(); });
      throw e instanceof BackupError ? e : new BackupError('FAILED', message);
    }
  }

  /** The newest backup that can be read (a corrupt one is skipped), or null when Drive holds none. */
  private async newest(sub: string, drive: DriveClient): Promise<BackupBundle | null> {
    for (const f of newestFirst(await drive.list(backupPrefix(sub)))) {
      try {
        return unbundle(await drive.get(f.id), sub, this.prefixes);
      } catch (e) {
        this.log(`backup: skipping an unreadable version of ${subHash(sub)}: ${(e as Error).message}`);
      }
    }
    return null;
  }

  /** Restores onto an empty server; marks `restorePending` when Drive could not be asked. */
  private async autoRestoreInner(sub: string, drive: DriveClient): Promise<boolean> {
    if (this.hasData(sub)) {
      this.setState(sub, (x) => { delete x.restorePending; });
      return false;
    }
    let found: BackupBundle | null;
    try {
      found = await this.newest(sub, drive);
    } catch (e) {
      this.setState(sub, (x) => { x.restorePending = true; });
      throw e;
    }
    if (!found) {
      this.setState(sub, (x) => { delete x.restorePending; });
      return false;
    }
    await this.apply(sub, found);
    this.setState(sub, (x) => { x.lastBackupAt = found.created; x.lastHash = contentHash(this.collect(sub)); delete x.restorePending; delete x.error; delete x.errorAt; });
    this.log(`backup: restored ${subHash(sub)} from the backup of ${found.created}`);
    return true;
  }

  // ---- public operations ----------------------------------------------------

  /** "Back up now": forced, no throttle. Throws a {@link BackupError}. */
  async backupNow(sub: string): Promise<BackupStatus> {
    this.drive(sub);
    await this.serial(sub, () => this.backupInner(sub, true));
    return this.status(sub);
  }

  /**
   * Manual restore: the newest readable version replaces the person's data after a safety backup of the current
   * data (which must succeed). Throws a {@link BackupError}.
   */
  restore(sub: string): Promise<BackupStatus> {
    const drive = this.drive(sub);
    return this.serial(sub, async () => {
      let target: BackupBundle | null;
      try {
        target = await this.newest(sub, drive);
      } catch (e) {
        this.log(`backup: could not read the backups of ${subHash(sub)}: ${e instanceof Error ? e.message : String(e)}`);
        throw new BackupError('FAILED', publicMessage(e));
      }
      if (!target) throw new BackupError('NO_BACKUP', 'Google Drive holds no backup yet');
      if (this.hasData(sub)) await this.backupInner(sub, true);
      await this.apply(sub, target);
      this.setState(sub, (x) => { x.lastHash = contentHash(this.collect(sub)); delete x.restorePending; });
      this.log(`backup: restored ${subHash(sub)} from the backup of ${target.created}`);
      return this.status(sub);
    });
  }

  /** At sign-in: restores when the server has no data of the person and Drive has a backup. Never throws. */
  async restoreIfEmpty(sub: string): Promise<boolean> {
    if (!this.d.isOn() || !this.d.hasPermission(sub)) return false;
    try {
      const drive = this.drive(sub);
      return await this.serial(sub, () => this.autoRestoreInner(sub, drive));
    } catch (e) {
      this.log(`backup: restore at sign-in failed for ${subHash(sub)}: ${(e as Error).message}`);
      return false;
    }
  }

  // ---- triggers ---------------------------------------------------------------

  /** A change of the person's data: schedules a backup 2 minutes after the last change, 5 minutes after the last run. */
  touch(sub: string): void {
    if (!this.d.isOn() || !this.d.hasPermission(sub) || this.d.isPermitted?.(sub) === false || !this.d.driveFor(sub)) return;
    this.lastChange.set(sub, this.d.clock.real());
    const delay = debounceDelay({
      now: this.d.clock.real(), lastChange: this.lastChange.get(sub)!, lastRun: this.lastRun.get(sub) ?? null,
      debounceMs: this.timings.debounceMs, minIntervalMs: this.timings.minIntervalMs,
    });
    clearTimeout(this.timers.get(sub));
    const t = setTimeout(() => void this.fire(sub), delay);
    t.unref();
    this.timers.set(sub, t);
  }

  /** The debounce timer of one person ran out: back up unless nothing changed. Errors are already logged and stored. */
  private async fire(sub: string): Promise<boolean> {
    clearTimeout(this.timers.get(sub));
    this.timers.delete(sub);
    this.lastChange.delete(sub);
    this.lastRun.set(sub, this.d.clock.real());
    try {
      return (await this.serial(sub, () => this.backupInner(sub, false))) === 'done';
    } catch {
      return false;
    }
  }

  /** Fires every pending debounce timer now (TEST_MODE hook); returns how many backups were made. */
  async flush(): Promise<number> {
    const results = await Promise.all([...this.timers.keys()].map((sub) => this.fire(sub)));
    return results.filter(Boolean).length;
  }

  /** The people with a token file; found on disk, so people who never open the app are backed up too. */
  private people(): string[] {
    return listUserSubs(this.d.dataDir).filter((u) => this.d.hasPermission(u) && (this.d.isPermitted?.(u) ?? true));
  }

  /** The daily check: a forced backup for everyone whose last backup is 24 h old or whose last attempt failed. */
  async tick(): Promise<number> {
    if (!this.d.isOn()) return 0;
    let ran = 0;
    for (const sub of this.people()) {
      const s = this.state(sub);
      const last = s.lastBackupAt ? Date.parse(s.lastBackupAt) : NaN;
      if (!(Number.isNaN(last) || this.d.clock.nowMs() - last >= this.timings.dailyMs || s.error)) continue;
      try {
        if (!this.d.driveFor(sub)) continue;
        if ((await this.serial(sub, () => this.backupInner(sub, true))) === 'done') ran++;
      } catch {
        // already logged and stored in the person's state; the next check retries
      }
    }
    return ran;
  }

  /** Starts the hourly daily-check timer (first check one minute after start). Called by the server, not by tests. */
  start(): void {
    this.log(`backup: keeping the last ${this.timings.keep} versions per person`);
    this.first = setTimeout(() => void this.tick(), 60_000);
    this.interval = setInterval(() => void this.tick(), this.timings.checkEveryMs);
    this.first.unref();
    this.interval.unref();
  }

  /** Forgets the person's pending timers (the server "lost" their data). */
  forget(sub: string): void {
    clearTimeout(this.timers.get(sub));
    this.timers.delete(sub);
    this.lastChange.delete(sub);
    this.lastRun.delete(sub);
  }

  /** Back to the defaults, no pending timers, no state files (test reset). */
  reset(): void {
    for (const sub of [...this.timers.keys()]) this.forget(sub);
    this.lastRun.clear();
    Object.assign(this.timings, DEFAULT_TIMINGS);
    const users = path.join(this.d.dataDir, 'users');
    if (!fs.existsSync(users)) return;
    for (const u of fs.readdirSync(users)) fs.rmSync(path.join(users, u, 'backup-state.json'), { force: true });
  }

  close(): void {
    for (const sub of [...this.timers.keys()]) this.forget(sub);
    clearTimeout(this.first ?? undefined);
    clearInterval(this.interval ?? undefined);
  }
}
