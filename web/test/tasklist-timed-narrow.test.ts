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
  it('a 24 px block falls back to the first item inline with +k', () => {
    freshPinia();
    const w = mount(TaskListCard, { props: { segment: itemSegments(list(3))[0], variant: 'block', height: 24 } });
    expect(w.attributes('data-fit')).toBe('inline');
    expect(visible(w).map((e) => e.text())).toEqual(['Item 0']);
    expect(w.get('[data-testid=tasklist-card-more]').text()).toBe('+2');
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
