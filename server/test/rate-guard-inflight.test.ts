/** A read that started before a write must not answer callers who ask after the write (calendar colour bounced back). */
import { describe, expect, it } from 'vitest';
import { RateGuard } from '../src/providers/google/RateGuard.js';

describe('RateGuard in-flight reads and writes', () => {
  it('a caller after invalidate() does not get the answer of a read that started before it', async () => {
    const g = new RateGuard();
    let release!: (v: string) => void;
    const before = g.cached('calendarList', () => new Promise<string>((r) => { release = r; }));
    g.invalidate();
    const after = g.cached('calendarList', async () => 'new colour');
    release('old colour');
    expect(await before).toBe('old colour');
    expect(await after).toBe('new colour');
    expect(await g.cached('calendarList', async () => 'unused')).toBe('new colour');
  });
});
