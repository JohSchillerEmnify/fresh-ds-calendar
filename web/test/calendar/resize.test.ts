import { describe, expect, it } from 'vitest';
import { planResize, resizeEdges } from '@/features/calendar/resize';
import { itemSegments } from '@/lib/items';
import { ev, t } from './helpers';

const dentist = ev('dentist', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { title: 'Dentist' });
const seg = () => itemSegments(dentist)[0];
const list = (time: string, estimateMinutes: number) => itemSegments({
  kind: 'tasklist', id: 'l', title: 'L', date: '2026-10-15', time, estimateMinutes, items: [], doneCount: 0, totalCount: 0, color: '#000', etag: 'e',
} as never)[0];

describe('resizeEdges', () => {
  it('the end rounds up and the start rounds down to 15 minutes', () => {
    expect(resizeEdges(seg(), 'bottom', 52)).toEqual({ startMin: 540, endMin: 660 });
    expect(resizeEdges(seg(), 'top', -20)).toEqual({ startMin: 510, endMin: 600 });
  });
  it('tolerates a pixel or two past a slot line', () => {
    expect(resizeEdges(seg(), 'bottom', 31)).toEqual({ startMin: 540, endMin: 630 });
    expect(resizeEdges(seg(), 'top', -29)).toEqual({ startMin: 510, endMin: 600 });
  });
  it('keeps at least 15 minutes', () => {
    expect(resizeEdges(seg(), 'bottom', -90).endMin).toBe(555);
    expect(resizeEdges(seg(), 'top', 90).startMin).toBe(585);
  });
  it('events stop at the day boundaries, task lists at 12 hours', () => {
    expect(resizeEdges(seg(), 'bottom', 2000).endMin).toBe(1440);
    expect(resizeEdges(seg(), 'top', -2000).startMin).toBe(0);
    expect(resizeEdges(list('08:00', 600), 'bottom', 180).endMin).toBe(20 * 60);
    expect(resizeEdges(list('20:00', 600), 'top', -600).startMin).toBe(12 * 60);
  });
});

describe('planResize', () => {
  it('bottom handle patches the end only (start unchanged)', () => {
    const p = planResize(seg(), 'bottom', 60, 'Europe/Berlin')!;
    expect(p.patch).toEqual({ start: dentist.start, end: '2026-10-14T11:00:00+02:00' });
  });
  it('top handle patches the start only', () => {
    const p = planResize(seg(), 'top', -30, 'Europe/Berlin')!;
    expect(p.patch).toEqual({ start: '2026-10-14T08:30:00+02:00', end: dentist.end });
  });
  it('is null when the edge lands where it was', () => {
    expect(planResize(seg(), 'bottom', 0, 'Europe/Berlin')).toBeNull();
  });
  it('task lists: bottom changes the estimate, top changes time and estimate so the end stays', () => {
    expect(planResize(list('18:00', 30), 'bottom', 30, 'Europe/Berlin')!.patch).toEqual({ estimateMinutes: 60 });
    expect(planResize(list('18:00', 30), 'top', -30, 'Europe/Berlin')!.patch).toEqual({ time: '17:30', estimateMinutes: 60 });
  });
});
