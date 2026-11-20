import { describe, expect, it } from 'vitest';
import { landingMarks } from '@/features/calendar/landing';

const dates = ['2026-10-14', '2026-10-15'];
const none = { drag: null, resize: null, draw: null };

describe('landing marks (owner 2026-11-20, #173)', () => {
  it('marks a move from its start and length', () => {
    const m = landingMarks({ ...none, drag: { date: '2026-10-15', minutes: 14 * 60, durationMin: 60 } }, dates);
    expect(m.map((x) => [x.edge, x.time, x.col])).toEqual([['start', '14:00', 1], ['end', '15:00', 1]]);
  });
  it('marks a resize, but not while it springs back', () => {
    const r = { date: '2026-10-14', startMin: 510, endMin: 600 };
    expect(landingMarks({ ...none, resize: r }, dates).map((x) => x.time)).toEqual(['08:30', '10:00']);
    expect(landingMarks({ ...none, resize: { ...r, settle: true } }, dates)).toEqual([]);
  });
  it('marks a drawn block across two days, the end of a day as 24:00', () => {
    const draw = { dates, range: { start: 1380, end: 1440 + 60 } };
    expect(landingMarks({ ...none, draw }, dates).map((x) => [x.time, x.col])).toEqual([['23:00', 0], ['01:00', 1]]);
    expect(landingMarks({ ...none, draw: { dates, range: { start: 780, end: 1440 } } }, dates).map((x) => x.time)).toEqual(['13:00', '24:00']);
  });
  it('marks nothing when the entry is on another week', () => {
    expect(landingMarks({ ...none, drag: { date: '2026-11-01', minutes: 0, durationMin: 30 } }, dates)).toEqual([]);
  });
});
