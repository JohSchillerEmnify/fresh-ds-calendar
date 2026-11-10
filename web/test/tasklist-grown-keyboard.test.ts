/** The grown task list card: its pill is a button that collapses it, Enter on the card opens the list (feature tasklists-expand-card). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import type { TaskList } from '@/api/types';
import { itemSegments } from '@/lib/items';
import { useItemsStore } from '@/stores/items';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { freshPinia, mockFetch, config, settingsFixture } from './helpers';

const tl: TaskList = {
  kind: 'tasklist', id: 'G', calendarId: 'primary', title: 'Groceries', date: '2026-10-12', time: null, items: [{ id: 'i', title: 'Milk', done: false }], doneCount: 0,
  totalCount: 1, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: '"e"', updated: 'x',
};
let w: VueWrapper;
beforeEach(() => {
  mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture() });
  const pinia = freshPinia();
  useItemsStore(pinia).upsert(tl);
  w = mount(TaskListCard, { props: { segment: itemSegments(tl, '2026-10-12')[0], variant: 'card', height: 200, grown: true }, global: { plugins: [pinia] }, attachTo: document.body });
});
afterEach(() => w.unmount());

describe('grown card keyboard', () => {
  it('names the pill button after the collapse it does', () => {
    const b = w.get('button[data-testid="tasklist-card-pill"]');
    expect(b.attributes('aria-label')).toBe('Collapse Groceries');
  });

  it('a click anywhere on the pill collapses, a click on an item opens the list', async () => {
    await w.get('[data-testid="tasklist-card-title"]').trigger('click');
    await w.get('[data-testid="tasklist-card-check"]').trigger('click');
    await w.get('[data-testid="tasklist-card-pill"]').trigger('click');
    expect(w.emitted('collapse')).toHaveLength(3);
    await w.get('[data-testid="tasklist-card-item"]').trigger('click');
    expect(w.emitted('openList')).toHaveLength(1);
  });

  it('Enter on the card opens the list; Enter on the pill does not', async () => {
    await w.get('[data-testid="tasklist-card-grown"]').trigger('keydown', { key: 'Enter' });
    expect(w.emitted('openList')).toHaveLength(1);
    await w.get('[data-testid="tasklist-card-pill"]').trigger('keydown', { key: 'Enter' });
    expect(w.emitted('openList')).toHaveLength(1);
  });
});
