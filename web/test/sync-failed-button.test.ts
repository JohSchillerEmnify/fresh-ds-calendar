/** The "not synced" icon: 5 minutes without a successful send or sync, then a popover with the last sync and the unsent changes (ADR 0031). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SyncFailedButton from '@/components/shell/SyncFailedButton.vue';
import { useClockStore } from '@/stores/clock';
import { useOutboxStore } from '@/stores/outbox';
import { useSyncStore } from '@/stores/sync';
import { freshPinia } from './helpers';

const tid = (id: string) => `[data-testid="${id}"]`;
const T0 = Date.parse('2026-10-12T06:12:00Z'); // 08:12 in Berlin

function mountButton() {
  const pinia = freshPinia();
  useClockStore().config.timeZone = 'Europe/Berlin';
  useClockStore().startTicker();
  const sync = useSyncStore();
  sync.lastOk = { wall: Date.now(), app: T0 };
  sync.state = 'error';
  return { sync, w: mount(SyncFailedButton, { global: { plugins: [pinia] }, attachTo: document.body }) };
}

describe('sync failed icon', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); document.body.innerHTML = ''; });
  afterEach(() => vi.useRealTimers());

  it('shows after 5 minutes without a success, not before, and goes at the next success', async () => {
    const { sync, w } = mountButton();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(w.find(tid('sync-failed-icon')).exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(w.find(tid('sync-failed-icon')).exists()).toBe(true);
    sync.lastOk = { wall: Date.now(), app: T0 + 5 * 60_000 };
    await vi.advanceTimersByTimeAsync(2000);
    expect(w.find(tid('sync-failed-icon')).exists()).toBe(false);
  });

  it('waits for a sync that is running', async () => {
    const { sync, w } = mountButton();
    sync.state = 'syncing';
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(w.find(tid('sync-failed-icon')).exists()).toBe(false);
  });

  it('a successful send counts like a sync', async () => {
    const { w } = mountButton();
    useOutboxStore().lastSent = { wall: Date.now() + 4 * 60_000, app: T0 };
    await vi.advanceTimersByTimeAsync(8 * 60_000);
    expect(w.find(tid('sync-failed-icon')).exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(w.find(tid('sync-failed-icon')).exists()).toBe(true);
  });

  it('opens a popover with the last sync and the unsent changes, and says when there are none', async () => {
    const { w } = mountButton();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    useClockStore().config.timeZone = 'Europe/Berlin';
    const btn = w.get(tid('sync-failed-icon'));
    expect(btn.attributes('aria-label')).toBe('Not synced — details');
    await btn.trigger('click');
    await nextTick();
    const pop = document.querySelector(tid('sync-failed-popover'))!;
    expect(pop.getAttribute('data-presentation')).toBe('popover');
    expect(btn.attributes('aria-expanded')).toBe('true');
    expect(document.querySelector(tid('sync-failed-last'))!.textContent).toMatch(/at 08:12$/);
    expect(document.querySelector(tid('sync-failed-empty'))!.textContent).toBe('Nothing waiting to be sent.');
    useOutboxStore().entries = [{ key: 'k', person: '-', seq: 1, title: 'Milk', change: { op: 'item.patch', id: 'G', itemId: 'm', patch: { done: true } } }];
    await nextTick();
    expect([...document.querySelectorAll(tid('sync-failed-change'))].map((x) => x.textContent)).toEqual(['Milk ticked']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(document.querySelector(tid('sync-failed-popover'))).toBeNull();
  });
});
