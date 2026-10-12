import { parseIsoDate } from '@/lib/dates';

export interface TaskListForm {
  title: string;
  date: string;
  time: string;
  estimate: string;
  categoryId: string; // 'none' = no category
  tags: string;
  items: string;
  repeat: '' | 'daily' | 'weekly' | 'monthly';
}

/** "a, B,a ,," -> ['a', 'B'] (comma separated, trimmed, unique case-insensitively, order kept). */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const t = raw.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

export function parseItems(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** First problem as a user-facing sentence, or null when the form can be saved. */
export function validateForm(f: TaskListForm): string | null {
  if (!f.title.trim()) return 'Title is required';
  if (f.title.trim().length > 200) return 'Title is too long (200 characters at most)';
  if (!parseIsoDate(f.date)) return 'Pick a date';
  if (f.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time)) return 'Enter a time like 18:00';
  if (f.estimate.trim()) {
    const n = Number(f.estimate);
    if (!Number.isInteger(n) || n < 5 || n > 720) return 'Estimate must be a whole number of minutes from 5 to 720';
  }
  const tags = parseTags(f.tags);
  if (tags.length > 10) return 'Use at most 10 tags';
  if (tags.some((t) => t.length > 30)) return 'Tags can have 30 characters at most';
  if (parseItems(f.items).length > 200) return 'A task list can have 200 items at most';
  if (parseItems(f.items).some((t) => t.length > 200)) return 'Item titles can have 200 characters at most';
  return null;
}
