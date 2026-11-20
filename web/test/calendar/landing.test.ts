import { describe, expect, it } from 'vitest';
import type { CalendarEvent, TaskList } from '@/api/types';
import { itemLengthMin, landingMarks } from '@/features/calendar/landing';

const dates = ['2026-10-14', '2026-10-15'];
const none = { drag: null, resize: null, draw: null };
const times = (m: { time: string }[]) => m.map((x) => x.time);

describe('landing marks', () => {
  it('marks a move from its start and the whole length', () => {
    const m = landingMarks({ ...none, drag: { date: '2026-10-15', minutes: 14 * 60, lengthMin: 60 } }, dates);
    expect(m.map((x) => [x.edge, x.time, x.col])).toEqual([['start', '14:00', 1], ['end', '15:00', 1]]);
  });
  it('marks only the start when a move ends on the next day', () => {
    expect(times(landingMarks({ ...none, drag: { date: '2026-10-14', minutes: 23 * 60 + 30, lengthMin: 60 } }, dates))).toEqual(['23:30']);
    expect(times(landingMarks({ ...none, drag: { date: '2026-10-14', minutes: 23 * 60, lengthMin: 60 } }, dates))).toEqual(['23:00', '24:00']);
  });
  it('takes the length of an overnight event and of a task list from the entry', () => {
    const late = { kind: 'event', start: '2026-10-14T22:00:00+02:00', end: '2026-10-15T02:00:00+02:00' } as CalendarEvent;
    expect(itemLengthMin(late)).toBe(240);
    expect(itemLengthMin({ kind: 'tasklist', estimateMinutes: 45 } as TaskList)).toBe(45);
    expect(itemLengthMin({ kind: 'tasklist', estimateMinutes: null } as TaskList)).toBe(30);
  });
  it('marks a resize; only the start when the segment goes on past midnight', () => {
    const r = { date: '2026-10-14', startMin: 510, endMin: 600 };
    expect(times(landingMarks({ ...none, resize: r }, dates))).toEqual(['08:30', '10:00']);
    expect(times(landingMarks({ ...none, resize: { ...r, endMin: 1440, continues: true } }, dates))).toEqual(['08:30']);
  });
  it('marks a drawn block, the end of a day as 24:00, and only the start across days', () => {
    expect(times(landingMarks({ ...none, draw: { dates, range: { start: 780, end: 1440 } } }, dates))).toEqual(['13:00', '24:00']);
    expect(landingMarks({ ...none, draw: { dates, range: { start: 1380, end: 1440 + 60 } } }, dates).map((x) => [x.time, x.col])).toEqual([['23:00', 0]]);
  });
  it('finds a drawn column of another grid by its date', () => {
    const draw = { dates: ['2026-10-15', '2026-10-16'], range: { start: 600, end: 660 } };
    expect(landingMarks({ ...none, draw }, ['2026-10-14', '2026-10-15']).map((x) => x.col)).toEqual([1, 1]);
  });
  it('marks nothing when the entry is on another week', () => {
    expect(landingMarks({ ...none, drag: { date: '2026-11-01', minutes: 0, lengthMin: 30 } }, dates)).toEqual([]);
  });
});
