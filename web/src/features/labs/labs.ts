import { toIsoDate } from '@/lib/dates';

/** Route path of an experimental Labs view; the timeline has no date. */
export function labPath(lab: string, d: Date): string {
  return lab === 'timeline' ? '/timeline' : `/${lab}/${toIsoDate(d)}`;
}
