import fs from 'node:fs';
import path from 'node:path';
import type { Clock } from '../../lib/clock.js';
import { readJson, writeJsonAtomic } from '../../lib/atomicJson.js';
import { DriveError, type DriveClient, type DriveFile } from '../DriveClient.js';

interface Stored extends DriveFile { owner: string; content: string }
interface Persisted { seq: number; files: Stored[] }

/**
 * Drive double for TEST_MODE: the hidden app folders of all people in `DATA_DIR/mock-drive.json` (one folder per
 * person). `down` makes every call fail, like an outage. Created times come from the app clock, ids from a counter.
 */
export class MockDrive {
  /** While true every call fails with a 503. */
  down = false;
  private seq = 0;
  private files: Stored[] = [];

  constructor(private readonly file: string | null, private readonly clock: Clock) {
    const p = file ? readJson<Persisted>(file) : null;
    if (p && Array.isArray(p.files)) {
      this.files = p.files;
      this.seq = p.seq ?? 0;
    }
  }

  /** The folder of one person as a {@link DriveClient}. */
  forPerson(sub: string): DriveClient {
    const guard = () => { if (this.down) throw new DriveError('Google Drive is unavailable', 503); };
    const strip = ({ id, name, createdTime }: Stored): DriveFile => ({ id, name, createdTime });
    return {
      list: async (prefix) => { guard(); return this.files.filter((f) => f.owner === sub && f.name.startsWith(prefix)).map(strip); },
      create: async (name, content) => {
        guard();
        const f: Stored = { id: `mockfile-${String(++this.seq).padStart(8, '0')}`, name, createdTime: this.clock.now().toISOString(), owner: sub, content };
        this.files.push(f);
        this.save();
        return strip(f);
      },
      get: async (id) => {
        guard();
        const f = this.files.find((x) => x.owner === sub && x.id === id);
        if (!f) throw new DriveError('File not found', 404);
        return f.content;
      },
      delete: async (id) => {
        guard();
        this.files = this.files.filter((x) => !(x.owner === sub && x.id === id));
        this.save();
      },
    };
  }

  /** The files of one person (test endpoint), without content. */
  filesOf(sub: string): DriveFile[] {
    return this.files.filter((f) => f.owner === sub).map(({ id, name, createdTime }) => ({ id, name, createdTime }));
  }

  /** Empties every folder and ends an outage (test reset). */
  reset(): void {
    this.files = [];
    this.seq = 0;
    this.down = false;
    if (this.file) fs.rmSync(this.file, { force: true });
  }

  private save(): void {
    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      writeJsonAtomic(this.file, { seq: this.seq, files: this.files } satisfies Persisted);
    }
  }
}
