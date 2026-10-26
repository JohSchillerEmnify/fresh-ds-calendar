import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindGridDraw, drawPreview, drawRange, splitByDay } from '@/features/calendar/draw';
import { useUiStore } from '@/stores/ui';
import { freshPinia } from '../helpers';
import { pe } from '../motion/helpers';
import { newForm } from '@/features/calendar/eventForm';
import { newTaskListForm } from '@/features/tasklists/validate';

describe('drawing a block on the time grid (feature event-editing, owner 2026-10-25)', () => {
  it('snaps each end to the nearest quarter hour', () => {
    expect(drawRange(9 * 60 + 7, 10 * 60 + 22, false)).toEqual({ start: 540, end: 615 });
    expect(drawRange(540, 630, false)).toEqual({ start: 540, end: 630 });
  });
  it('runs upwards from where the pointer stopped to where it started', () => {
    expect(drawRange(660, 600, false)).toEqual({ start: 600, end: 660 });
  });
  it('is at least 15 minutes long', () => {
    expect(drawRange(545, 548, false)).toEqual({ start: 540, end: 555 });
  });
  it('a long press without moving gives the quarter hour under the finger', () => {
    expect(drawRange(9 * 60 + 20, 9 * 60 + 20, true)).toEqual({ start: 555, end: 570 });
  });
  it('crosses into the next day (minutes count on from the first day)', () => {
    expect(drawRange(22 * 60, 1440 + 60, false)).toEqual({ start: 1320, end: 1500 });
  });
  it('splits a range into one piece per day, the end of a day as 24:00', () => {
    expect(splitByDay({ start: 1320, end: 1500 })).toEqual([{ day: 0, start: 1320, end: 1440 }, { day: 1, start: 0, end: 60 }]);
    expect(splitByDay({ start: 540, end: 630 })).toEqual([{ day: 0, start: 540, end: 630 }]);
  });
  it('the new event lasts the drawn length, overnight too; a new task list gets it as its estimate, at most 12 hours', () => {
    expect(newForm('2026-10-14', '09:00', 'primary', null, 90)).toMatchObject({ startTime: '09:00', endDate: '2026-10-14', endTime: '10:30' });
    expect(newForm('2026-10-14', '22:00', 'primary', null, 180)).toMatchObject({ endDate: '2026-10-15', endTime: '01:00' });
    expect(newForm('2026-10-14', '09:00', 'primary', null)).toMatchObject({ endTime: '10:00' });
    expect(newTaskListForm('2026-10-14', '09:00', 90)).toMatchObject({ time: '09:00', estimate: '90' });
    expect(newTaskListForm('2026-10-14', '08:00', 1020).estimate).toBe('720');
    expect(newTaskListForm('2026-10-14', '08:00').estimate).toBe('');
  });
});

describe('the draw gesture on a time grid', () => {
  // a fake week grid: 2 columns of 100 px after a 44 px gutter, 48 px per hour, from y = 0
  const rect = (l: number, tp: number, w: number, h: number) => ({ left: l, top: tp, right: l + w, bottom: tp + h, width: w, height: h, x: l, y: tp, toJSON() { /* */ } }) as DOMRect;
  let grid: HTMLElement;
  let opened: unknown[];
  let dispose: () => void;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    freshPinia();
    const { registerDialog } = await import('@/extensions/registry');
    registerDialog('event', () => Promise.resolve({}) as never);
    opened = [];
    const ui = useUiStore();
    ui.$onAction(({ name, args }) => { if (name === 'openDialog') opened.push(args[1]); });
    grid = document.createElement('div');
    grid.dataset.testid = 'time-grid';
    grid.dataset.hourHeight = '48';
    grid.getBoundingClientRect = () => rect(0, 0, 244, 1152);
    ['2026-10-14', '2026-10-15'].forEach((d, i) => {
      const col = document.createElement('div');
      col.dataset.testid = 'week-day-column';
      col.dataset.date = d;
      col.getBoundingClientRect = () => rect(44 + 100 * i, 0, 100, 1152);
      const slot = document.createElement('button');
      slot.dataset.testid = 'time-slot';
      col.appendChild(slot);
      grid.appendChild(col);
    });
    document.body.appendChild(grid);
    dispose = bindGridDraw(grid, { scroller: () => null, disabled: () => false });
  });
  afterEach(() => { dispose(); grid.remove(); drawPreview.value = null; vi.useRealTimers(); vi.unstubAllGlobals(); });
  const slot = () => grid.querySelector<HTMLElement>('[data-testid="time-slot"]')!;
  const at = (min: number, col = 0) => ({ x: 94 + 100 * col, y: (min / 60) * 48 });
  const down = (p: { x: number; y: number }, type = 'mouse') => slot().dispatchEvent(pe('pointerdown', { ...p, pointerType: type }));
  const move = (p: { x: number; y: number }, type = 'mouse') => window.dispatchEvent(pe('pointermove', { ...p, pointerType: type }));
  const up = (p: { x: number; y: number }, type = 'mouse') => window.dispatchEvent(pe('pointerup', { ...p, pointerType: type }));

  it('mouse: press and drag draws, the release opens the new dialog with start and length, and the slot click is swallowed', () => {
    down(at(540));
    move(at(600));
    expect(drawPreview.value?.range).toEqual({ start: 540, end: 600 });
    move(at(630));
    up(at(630));
    expect(opened).toEqual([{ mode: 'create', date: '2026-10-14', time: '09:00', minutes: 90 }]);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    slot().dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });
  it('mouse: a click without moving draws nothing (the slot opens the dialog at its hour, as before)', () => {
    down(at(540));
    up(at(540));
    expect(opened).toEqual([]);
    expect(drawPreview.value).toBeNull();
  });
  it('week: the block may reach into the next day column', () => {
    down(at(22 * 60));
    move(at(60, 1));
    up(at(60, 1));
    expect(opened).toEqual([{ mode: 'create', date: '2026-10-14', time: '22:00', minutes: 180 }]);
  });
  it('touch: a long press then a drag draws; a long press let go without moving gives the quarter hour under the finger', () => {
    down(at(560), 'touch');
    vi.advanceTimersByTime(400);
    expect(drawPreview.value?.range).toEqual({ start: 555, end: 570 });
    up(at(560), 'touch');
    expect(opened).toEqual([{ mode: 'create', date: '2026-10-14', time: '09:15', minutes: 15 }]);
  });
  it('touch: moving before the long press is a scroll and draws nothing', () => {
    down(at(540), 'touch');
    move({ x: at(540).x, y: at(540).y + 30 }, 'touch');
    vi.advanceTimersByTime(400);
    expect(drawPreview.value).toBeNull();
    up(at(600), 'touch');
    expect(opened).toEqual([]);
  });
  it('touch: the grid has its own non-passive touchmove listener, which stops the scroll only while drawing', () => {
    const tm = () => { const e = new Event('touchmove', { bubbles: true, cancelable: true }); Object.defineProperty(e, 'touches', { value: [] }); slot().dispatchEvent(e); return e.defaultPrevented; };
    down(at(540), 'touch');
    expect(tm()).toBe(false);
    vi.advanceTimersByTime(400);
    expect(tm()).toBe(true);
    up(at(540), 'touch');
  });
});
