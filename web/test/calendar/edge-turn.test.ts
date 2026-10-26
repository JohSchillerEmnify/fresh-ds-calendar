import { afterEach, describe, expect, it } from 'vitest';
import { EDGE_HOLD_MS, EDGE_ZONE_PX, edgeLabel, edgeSide } from '@/features/calendar/edgeTurn';
import { applyLanguage } from '@/i18n';

const d = (s: string) => new Date(`${s}T00:00:00`);

describe('edge turn while dragging (feature drag-to-reschedule, owner 2026-10-25)', () => {
  afterEach(async () => { await applyLanguage('en'); });
  it('the zone is the outer 24 px of the day columns on each side; the hold is 0.6 s in the day view, 1 s in the week view', () => {
    expect(EDGE_ZONE_PX).toBe(24);
    expect(EDGE_HOLD_MS).toEqual({ day: 600, week: 1000 });
    expect([edgeSide(100, 100, 400), edgeSide(123, 100, 400), edgeSide(124, 100, 400), edgeSide(376, 100, 400), edgeSide(377, 100, 400), edgeSide(399, 100, 400)])
      .toEqual(['left', 'left', null, null, 'right', 'right']);
    // outside the columns (the hour labels, past the right edge) is no zone
    expect([edgeSide(99, 100, 400), edgeSide(401, 100, 400)]).toEqual([null, null]);
  });
  it('labels the day or week a turn leads to, with the arrow on its side', () => {
    expect(edgeLabel('day', d('2026-10-14'), 1)).toBe('Thu 15 ›');
    expect(edgeLabel('day', d('2026-10-14'), -1)).toBe('‹ Tue 13');
    expect(edgeLabel('week', d('2026-10-14'), 1)).toBe('19–25 Oct ›');
    expect(edgeLabel('week', d('2026-10-14'), -1)).toBe('‹ 5–11 Oct');
    expect(edgeLabel('week', d('2026-10-21'), 1)).toBe('26 Oct – 1 Nov ›');
  });
  it('speaks German in German', async () => {
    await applyLanguage('de');
    expect(edgeLabel('day', d('2026-10-14'), 1)).toMatch(/^Do\.?,? 15\. ›$/);
    expect(edgeLabel('week', d('2026-10-14'), 1)).toBe('19.–25. Okt. ›');
  });
});
