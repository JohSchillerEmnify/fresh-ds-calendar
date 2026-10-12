import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { TaskList } from '@/api/types';
import { itemSegments, segmentMinPx, blockGeometry } from '@/lib/items';
import { freshPinia } from './helpers';

vi.mock('@vueuse/core', async (orig) => ({ ...(await orig<object>()), useElementSize: () => ({ width: ref(47), height: ref(45) }) }));
const { default: TaskListCard } = await import('@/features/tasklists/TaskListCard.vue');

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, title: `Item ${i}`, done: false }));
const list = (n: number, est = 45): TaskList => ({ kind: 'tasklist', id: 'p', calendarId: 'primary', title: 'Packing', date: '2026-10-14', time: '09:00', items: mk(n), doneCount: 0, totalCount: n, estimateMinutes: est, color: '#039be5', etag: 'e' }) as unknown as TaskList;
const visible = (w: ReturnType<typeof mount>) => w.findAll('.it').filter((e) => !e.classes().includes('over'));

describe('timed task list block in a 47 x 45 px column', () => {
  it('shows open item rows and a +k badge', () => {
    freshPinia();
    const w = mount(TaskListCard, { props: { segment: itemSegments(list(6))[0], variant: 'block', height: 45 } });
    expect(w.attributes('data-tier')).toBe('mini');
    expect(visible(w).length).toBeGreaterThanOrEqual(1);
    expect(w.get('[data-testid=tasklist-card-more]').text()).toMatch(/^\+\d/);
  });
  it('a 24 px block shows up to two items inline with +k', () => {
    freshPinia();
    const w = mount(TaskListCard, { props: { segment: itemSegments(list(3))[0], variant: 'block', height: 24 } });
    expect(w.attributes('data-fit')).toBe('inline');
    expect(visible(w).map((e) => e.text())).toEqual(['Item 0', 'Item 1']);
    expect(w.get('[data-testid=tasklist-card-more]').text()).toBe('+1');
  });
  it('lists with open items get a 44 px minimum height, events 24', () => {
    const seg = itemSegments(list(2, 15))[0];
    expect(segmentMinPx(seg)).toBe(44);
    expect(blockGeometry(seg.startMin, seg.endMin, 48, segmentMinPx(seg)).height).toBe(44);
  });
});

import { rowStep } from '@/features/tasklists/layout';
describe('rowStep (truncation fade)', () => {
  it('steps down with the row index and respects the floors', () => {
    expect(rowStep(0, 3)).toEqual({ scale: 1, opacity: 1 });
    expect(rowStep(1, 3).opacity).toBeCloseTo(0.85);
    expect(rowStep(2, 3).scale).toBeCloseTo(0.7);
    expect(rowStep(9, 3)).toEqual({ scale: 0.7, opacity: 0.5 });
  });
  it('does nothing when nothing is truncated', () => {
    expect(rowStep(2, 0)).toEqual({ scale: 1, opacity: 1 });
  });
  it('card applies the style only when truncated', () => {
    freshPinia();
    const few = mount(TaskListCard, { props: { segment: itemSegments(list(2))[0], variant: 'card', height: 200 } });
    expect(few.findAll('.it').every((e) => !e.attributes('style'))).toBe(true);
    const many = mount(TaskListCard, { props: { segment: itemSegments(list(6))[0], variant: 'card', height: 200 } });
    const vis = visible(many);
    expect(vis[1].attributes('style')).toContain('opacity: 0.85');
    expect(vis[1].classes()).toContain('fade');
  });
});

describe('inline mode for blocks of about an hour or less', () => {
  const mount2 = (n: number, height: number) => mount(TaskListCard, { props: { segment: itemSegments(list(n))[0], variant: 'block', height } });
  it('44 px block: items inline, max 2 shown, +k, no time footer', () => {
    freshPinia();
    const w = mount2(5, 44);
    expect(w.attributes('data-fit')).toBe('inline');
    expect(visible(w).map((e) => e.text())).toEqual(['Item 0', 'Item 1']);
    expect(w.findAll('.sep:not(.nosep)')).toHaveLength(1);
    expect(w.get('[data-testid=tasklist-card-more]').text()).toMatch(/\+3/);
    expect(w.find('.foot').exists()).toBe(false);
  });
  it('taller blocks keep list rows', () => {
    freshPinia();
    expect(mount2(5, 90).attributes('data-fit')).not.toBe('inline');
  });
  it('no per-card chevron any more', () => {
    freshPinia();
    expect(mount2(3, 90).find('[data-testid=tasklist-card-toggle]').exists()).toBe(false);
  });
});
