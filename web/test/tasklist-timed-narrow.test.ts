import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { TaskList } from '@/api/types';
import { itemSegments, segmentMinPx, blockGeometry } from '@/lib/items';
import { freshPinia } from './helpers';

const cardWidth = vi.hoisted(() => ({ px: 47 }));
vi.mock('@vueuse/core', async (orig) => ({ ...(await orig<object>()), useElementSize: () => ({ width: ref(cardWidth.px), height: ref(45) }) }));
const { default: TaskListCard } = await import('@/features/tasklists/TaskListCard.vue');

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, title: `Item ${i}`, done: false }));
const list = (n: number, est = 45): TaskList => ({ kind: 'tasklist', id: 'p', calendarId: 'primary', title: 'Packing', date: '2026-10-14', time: '09:00', items: mk(n), doneCount: 0, totalCount: n, estimateMinutes: est, color: '#039be5', etag: 'e' }) as unknown as TaskList;
const visible = (w: ReturnType<typeof mount>) => w.findAll('.it').filter((e) => !e.classes().includes('over'));

describe('timed task list block in a 47 x 45 px column', () => {
  it('shows open item rows and fades the rest out, no count', () => {
    freshPinia();
    const w = mount(TaskListCard, { props: { segment: itemSegments(list(6))[0], variant: 'block', height: 45 } });
    expect(w.attributes('data-tier')).toBe('mini');
    expect(visible(w).length).toBeGreaterThanOrEqual(1);
    expect(w.find('[data-testid=tasklist-card-more]').exists()).toBe(false);
    expect(w.get('[data-testid=tasklist-card-items]').attributes('data-fade')).toBe('true');
  });
  it('a short block puts items in rows below the title, never inline', () => {
    freshPinia();
    const w = mount(TaskListCard, { props: { segment: itemSegments(list(3))[0], variant: 'block', height: 33 } });
    expect(w.attributes('data-fit')).not.toBe('inline');
    expect(visible(w).map((e) => e.text())).toEqual(['Item 0']);
    expect(w.find('[data-testid=tasklist-card-more]').exists()).toBe(false);
  });
  it('lists with open items get a 44 px minimum height, events 24', () => {
    const seg = itemSegments(list(2, 15))[0];
    expect(segmentMinPx(seg)).toBe(44);
    expect(blockGeometry(seg.startMin, seg.endMin, 48, segmentMinPx(seg)).height).toBe(44);
  });
});

describe('inline mode for blocks of about an hour or less in a wide column', () => {
  beforeEach(() => { cardWidth.px = 200; });
  afterEach(() => { cardWidth.px = 47; });
  const mount2 = (n: number, height: number) => mount(TaskListCard, { props: { segment: itemSegments(list(n))[0], variant: 'block', height } });
  it('44 px block: every open item inline (the line fades out), no fade, no time footer', () => {
    freshPinia();
    const w = mount2(5, 44);
    expect(w.attributes('data-fit')).toBe('inline');
    expect(visible(w).map((e) => e.text())).toEqual(['Item 0', 'Item 1', 'Item 2', 'Item 3', 'Item 4']);
    expect(w.findAll('.sep:not(.nosep)')).toHaveLength(4);
    expect(w.find('[data-testid=tasklist-card-more]').exists()).toBe(false);
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
