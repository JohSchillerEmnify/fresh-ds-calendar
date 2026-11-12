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

  /** The person's kept uploads, oldest first. */
  list(sub: string): DiagUpload[] {
    return this.files.read(sub).uploads;
  }

  /** Keeps the upload and drops the oldest beyond {@link MAX_UPLOADS}. */
  add(sub: string, upload: DiagUpload): void {
    this.files.write(sub, { version: 1, uploads: [...this.list(sub), upload].slice(-MAX_UPLOADS) });
  }

  reset(): void {
    this.files.reset();
  }
}
