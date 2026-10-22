/** Release notes: parses the user-facing lines of CHANGELOG.md (feature release-notes). */
import { createHash } from 'node:crypto';
import fs from 'node:fs';

export interface ReleaseNote {
  id: string;
  /** Merge date, YYYY-MM-DD. */
  date: string;
  text: string;
}

export const MAX_RELEASE_NOTES = 50;

/** Returns the short stable id of a note: a hash of its date and text. */
export function noteId(date: string, text: string): string {
  return createHash('sha1').update(`${date}\n${text}`).digest('hex').slice(0, 8);
}

/**
 * Parses CHANGELOG.md text into release notes, newest first.
 *
 * Reads the `## YYYY-MM-DD` sections up to `## Older history`; every `- ` bullet is one note and indented
 * continuation lines belong to it. Anything else is ignored, so garbled input yields fewer or no notes.
 *
 * @param markdown The CHANGELOG.md content.
 * @returns At most {@link MAX_RELEASE_NOTES} notes, newest date first, file order within a day.
 */
export function parseReleaseNotes(markdown: string): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  let date: string | null = null;
  let open: string[] | null = null;
  const flush = () => {
    const text = open?.join(' ').replace(/\s+/g, ' ').trim();
    if (date && text) notes.push({ id: noteId(date, text), date, text });
    open = null;
  };
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.*?)\s*$/.exec(line);
    if (heading) {
      flush();
      if (/^older history$/i.test(heading[1]!)) break;
      date = /^\d{4}-\d{2}-\d{2}$/.test(heading[1]!) ? heading[1]! : null;
    } else if (/^- /.test(line)) {
      flush();
      open = [line.slice(2)];
    } else if (open && /^\s+\S/.test(line)) open.push(line);
    else flush();
  }
  flush();
  // stable sort: lines of one day keep their file order
  return notes.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, MAX_RELEASE_NOTES);
}

/** Reads and parses a CHANGELOG.md file; a missing or unreadable file gives an empty list. */
export function loadReleaseNotes(file: string): ReleaseNote[] {
  try {
    return parseReleaseNotes(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}
