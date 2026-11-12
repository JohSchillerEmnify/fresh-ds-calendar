/** Error logs a person sent from their device (ADR 0045): the last few uploads per person, one JSON file each, never in Google. */
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

export const MAX_UPLOADS = 5;

export interface DiagUpload { receivedAt: string; app: string; entries: unknown[] }
interface Doc { version: 1; uploads: DiagUpload[] }

export class DiagUploadStore {
  private readonly files: PersonJsonStore<Doc>;

  constructor(dataDir: string, log: (m: string) => void = (m) => console.warn(m)) {
    this.files = new PersonJsonStore<Doc>(dataDir, 'device-log-uploads.json',
      (r) => (isRecord(r) && Array.isArray(r.uploads) ? { version: 1, uploads: r.uploads as DiagUpload[] } : null),
      () => ({ version: 1, uploads: [] }), (m) => log(`diag uploads: ${m}`));
  }

  /** Last accepted upload per person; kept in memory, so a restart only ever lets one more through. */
  private readonly last = new Map<string, number>();

  /** Whether the person may upload now (at most one per `everyMs`); a yes counts as an upload. */
  allow(sub: string, now: number, everyMs: number): boolean {
    for (const [k, t] of this.last) if (now - t >= everyMs) this.last.delete(k);
    if (this.last.has(sub)) return false;
    this.last.set(sub, now);
    return true;
  }

  /** The person's kept uploads, oldest first. */
  list(sub: string): DiagUpload[] {
    return this.files.read(sub).uploads;
  }

  /** Keeps the upload and drops the oldest beyond {@link MAX_UPLOADS}. */
  add(sub: string, upload: DiagUpload): void {
    this.files.write(sub, { version: 1, uploads: [...this.list(sub), upload].slice(-MAX_UPLOADS) });
  }

  reset(): void {
    this.last.clear();
    this.files.reset();
  }
}
