/** The grown task list card is remembered on this device (feature tasklists-expand-card, rule "remembered on this device"). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { TaskList } from '@/api/types';
import { itemSegments } from '@/lib/items';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { EXPANDED_CARD_KEY, useUiStore } from '@/stores/ui';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

// jsdom has no layout: the real grown card would see its zero-size anchor as out of sight and close itself
vi.mock('@/features/tasklists/ExpandedCard.vue', () => ({ __esModule: true, default: { name: 'ExpandedCard', render: () => null } }));

function list(id: string, date: string, done: boolean[] = [false, false]): TaskList {
  const items = done.map((d, i) => ({ id: `${id}-i${i}`, title: `Item ${i}`, done: d }));
  return {
    kind: 'tasklist', id, calendarId: 'primary', title: id, date, time: null, items, doneCount: items.filter((i) => i.done).length,
    totalCount: items.length, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: `"e-${id}"`, updated: 'x',
  };
}
const stored = () => JSON.parse(localStorage.getItem(EXPANDED_CARD_KEY) ?? 'null') as unknown;

let pinia: ReturnType<typeof freshPinia>;
const wrappers: VueWrapper[] = [];
function card(tl: TaskList) {
  useItemsStore(pinia).upsert(tl);
  const w = mount(TaskListCard, { props: { segment: itemSegments(tl, '2026-10-12')[0], variant: 'card', height: 200 }, global: { plugins: [pinia] }, attachTo: document.body });
  wrappers.push(w);
  return w;
}
/** A fresh app on this device: new stores, the test clock loaded again (it reads what the device remembered). */
async function restart(remembered?: { id: string; date: string }) {
  if (remembered) localStorage.setItem(EXPANDED_CARD_KEY, JSON.stringify(remembered));
  pinia = freshPinia();
  // the frozen test clock (today 2026-10-12), set directly so no earlier test's network state decides it
  useClockStore(pinia).restore(config() as never);
  await useSettingsStore(pinia).load();
  usePrefsStore(pinia).taskOpen = 'inline';
}
const expanded = (w: VueWrapper) => w.get('[data-testid="tasklist-card"]').attributes('aria-expanded');

beforeEach(async () => {
  localStorage.clear();
  document.body.innerHTML = '';
  mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture() });
  await restart();
});
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); });

describe('remembered task list expansion', () => {
  it('stores the expanded card on the device and reads it back in a fresh app', async () => {
    useUiStore(pinia).expandCard({ id: 'G', date: '2026-10-14' });
    await nextTick();
    expect(stored()).toEqual({ id: 'G', date: '2026-10-14' });
    await restart();
    expect(useUiStore(pinia).expandedCard).toEqual({ id: 'G', date: '2026-10-14' });
  });

  it('a card that mounts with its list remembered grows again', async () => {
    await restart({ id: 'G', date: '2026-10-12' });
    const w = card(list('G', '2026-10-12'));
    await flushPromises();
    expect(expanded(w)).toBe('true');
  });

  it('a card going away keeps the memory; a card for the same list grows again', async () => {
    const w = card(list('G', '2026-10-12'));
    await w.get('[data-testid="tasklist-card"]').trigger('click');
    await flushPromises();
    expect(expanded(w)).toBe('true');
    w.unmount();
    wrappers.splice(0);
    await nextTick();
    expect(stored()).toEqual({ id: 'G', date: '2026-10-12' });
    const again = card(list('G', '2026-10-12'));
    await flushPromises();
    expect(expanded(again)).toBe('true');
  });

  it('only one copy of the list grows when it shows twice', async () => {
    await restart({ id: 'G', date: '2026-10-12' });
    const a = card(list('G', '2026-10-12'));
    const b = card(list('G', '2026-10-12'));
    await flushPromises();
    expect([expanded(a), expanded(b)].filter((x) => x === 'true')).toHaveLength(1);
  });

  it('a list whose day has passed starts collapsed (carried to today) and is forgotten', async () => {
    await restart({ id: 'G', date: '2026-10-11' });
    const w = card(list('G', '2026-10-11'));
    await flushPromises();
    expect(expanded(w)).toBe('false');
    expect(stored()).toBeNull();
  });

  it('a completed list starts collapsed and is forgotten', async () => {
    await restart({ id: 'G', date: '2026-10-12' });
    const w = card(list('G', '2026-10-12', [true, true]));
    await flushPromises();
    expect(expanded(w)).toBe('false');
    expect(stored()).toBeNull();
  });

  it('a tapped list that becomes complete collapses and is forgotten', async () => {
    const w = card(list('G', '2026-10-12', [true, false]));
    await w.get('[data-testid="tasklist-card"]').trigger('click');
    await flushPromises();
    expect(expanded(w)).toBe('true');
    await w.setProps({ segment: itemSegments(list('G', '2026-10-12', [true, true]), '2026-10-12')[0] });
    await flushPromises();
    expect(expanded(w)).toBe('false');
    expect(stored()).toBeNull();
  });

  it('a tapped list that is already complete still grows', async () => {
    const w = card(list('G', '2026-10-12', [true, true]));
    await w.get('[data-testid="tasklist-card"]').trigger('click');
    await flushPromises();
    expect(expanded(w)).toBe('true');
  });

  it('collapsing by hand forgets it', async () => {
    const w = card(list('G', '2026-10-12'));
    await w.get('[data-testid="tasklist-card"]').trigger('click');
    await flushPromises();
    useUiStore(pinia).collapseCard({ id: 'G', date: '2026-10-12' });
    await nextTick();
    expect(stored()).toBeNull();
  });
});
