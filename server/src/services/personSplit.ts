/** Moves the retired server-wide `settings.json` and `motivation.json` into every person's folder, once, on start. */
import fs from 'node:fs';
import path from 'node:path';
import { listUserSubs, userDir } from '../auth/people.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { isRecord } from '../lib/personJsonStore.js';

/** The files that were one per server and are one per person now (same name, below `users/<sub>/`). */
export const SPLIT_FILES = ['settings.json', 'motivation.json'] as const;

/** Copies each old file to every person in `subs` without their own, then renames it to `.bak`; idempotent, resumes if interrupted. */
export function splitServerWideFiles(dataDir: string, subs: string[], log: (m: string) => void = () => {}): void {
  for (const name of SPLIT_FILES) {
    const file = path.join(dataDir, name);
    if (!fs.existsSync(file)) continue;
    const doc = readJson<unknown>(file);
    // an unreadable old file is kept as it is rather than copied or retired
    if (!isRecord(doc)) continue;
    let copied = 0;
    // an id that is not a plain folder name (never a Google sub) is skipped, not allowed to stop the server
    for (const sub of new Set(subs.filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s)))) {
      const own = path.join(userDir(dataDir, sub), name);
      if (fs.existsSync(own)) continue;
      writeJsonAtomic(own, doc);
      copied++;
    }
    const bak = fs.existsSync(`${file}.bak`) ? `${file}.bak-${Date.now()}` : `${file}.bak`;
    fs.renameSync(file, bak);
    log(`${name}: copied to ${copied} people, kept as ${path.basename(bak)}`);
  }
}

/** Every person the start-up split copies to: those in `people.json`, those with a folder, and `local` (sign-in off). */
export function knownSubs(dataDir: string, peopleSubs: string[], local: string): string[] {
  return [...new Set([...peopleSubs, ...listUserSubs(dataDir), local])];
}
