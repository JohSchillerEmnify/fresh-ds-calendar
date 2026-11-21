/** "Share with": an email field with suggestions from the person's own contacts on the device (feature shared-lists, ADR 0046). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import TaskListDialog from '@/features/tasklists/TaskListDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

const BEA = { sub: 'sub-bea', name: 'Bea', email: 'bea@example.test', initial: 'B' };
const list = { kind: 'tasklist', id: 'G', calendarId: 'primary', title: 'G', date: null, time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: '"e"', updated: 'x' } as TaskList;
const answer = (people: unknown) => ({
  full: true, cursor: 'c1', window: { from: '2020-01-01', to: '2030-01-01' }, calendars: [],
  events: { calendars: [], replace: [], series: [], removed: [], upserts: [], failed: [] },
  taskLists: { replace: true, series: [], removed: [], upserts: [list], failed: false }, files: { people },
}) as never;

let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

async function open(routes: Record<string, () => unknown>) {
  const { calls } = mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture(), 'GET /api/tasklists/open': () => ({ items: [] }), ...routes });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  const router = createAppRouter(createMemoryHistory());
  router.push('/week/2026-10-12');
  await router.isReady();
  useAuthStore().status = 'in';
  const device = useDeviceStore();
  device.take(answer({ people: [] }));
  useItemsStore().upsert(list);
  wrapper = mount(TaskListDialog, { props: { mode: 'edit', id: 'G' }, global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { device, w: wrapper, calls };
}
const suggestions = (w: VueWrapper) => w.findAll('[data-testid="share-suggestions"] option').map((o) => o.attributes('value'));
const input = (w: VueWrapper) => w.get('input[data-testid="tasklist-share-person"]');

describe('Share with in the task list dialog', () => {
  it('is an email field that suggests the contacts the server holds, and keeps them on the device', async () => {
    const { w, device } = await open({ 'GET /api/people': () => ({ people: [BEA] }) });
    expect(input(w).attributes('type')).toBe('email');
    expect(input(w).attributes('list')).toBe(w.get('[data-testid="share-suggestions"]').attributes('id'));
    expect(suggestions(w)).toEqual(['bea@example.test']);
    expect(device.file<{ people: unknown[] }>('people')?.people).toHaveLength(1);
  });

  it('is there with nobody to suggest, because an address is typed', async () => {
    const { w } = await open({ 'GET /api/people': () => ({ people: [] }) });
    expect(w.find('input[data-testid="tasklist-share-person"]').exists()).toBe(true);
    expect(suggestions(w)).toEqual([]);
  });

  it('offers the addresses the device copy holds while offline', async () => {
    const { w } = await open({ 'GET /api/people': () => ({ status: 503, body: { error: { code: 'X', message: 'down' } } }) });
    expect(suggestions(w)).toEqual([]);
    useDeviceStore().take(answer({ people: [BEA] }));
    await flushPromises();
    expect(suggestions(w)).toEqual(['bea@example.test']);
  });

  it('sends the typed address as an invitation and keeps the dialog open with the pending line', async () => {
    const sent = { invitations: [], sent: [{ id: 'i1', kind: 'list', target: 'G', address: 'nobody@example.test', expires: 'x' }] };
    let answered = false;
    const { w, calls } = await open({
      'GET /api/people': () => ({ people: [] }), 'GET /api/invitations': () => (answered ? sent : { invitations: [], sent: [] }),
      'POST /api/tasklists/G/share': () => { answered = true; return list; },
    });
    await input(w).setValue('  Nobody@Example.test ');
    await w.get('[data-testid="tasklist-share"]').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.path === '/api/tasklists/G/share')?.body).toEqual({ email: 'Nobody@Example.test' });
    expect(w.get('[data-testid="tasklist-share-who"]').text()).toBe('Invitation sent to nobody@example.test');
    expect(w.find('input[data-testid="tasklist-share-person"]').exists()).toBe(true);
    expect(w.emitted('close')).toBeUndefined();
  });

  it('shows the pending invitation from the device copy and withdraws it', async () => {
    const { w, calls, device } = await open({
      'GET /api/people': () => ({ people: [] }), 'GET /api/invitations': () => ({ status: 503, body: { error: { code: 'X', message: 'down' } } }),
      'POST /api/invitations/i1/withdraw': () => ({ ok: true }),
    });
    device.putFile('invitations', { invitations: [], sent: [{ id: 'i1', kind: 'list', target: 'G', address: 'bea@example.test', expires: 'x' }] });
    await flushPromises();
    expect(w.get('[data-testid="tasklist-share-who"]').text()).toBe('Invitation sent to bea@example.test');
    await w.get('[data-testid="tasklist-invite-withdraw"]').trigger('click');
    await flushPromises();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/invitations/i1/withdraw')).toBe(true);
    expect(w.find('[data-testid="tasklist-share-who"]').exists()).toBe(false);
    expect(w.find('input[data-testid="tasklist-share-person"]').exists()).toBe(true);
  });

  it('shows a line for every pending invitation and keeps the field for another person', async () => {
    const { w, device } = await open({ 'GET /api/people': () => ({ people: [] }), 'GET /api/invitations': () => ({ status: 503, body: { error: { code: 'X', message: 'down' } } }) });
    device.putFile('invitations', { invitations: [], sent: [
      { id: 'i1', kind: 'list', target: 'G', address: 'bea@example.test', expires: 'x' }, { id: 'i2', kind: 'list', target: 'G', address: 'cy@example.test', expires: 'x' },
    ] });
    await flushPromises();
    expect(w.findAll('[data-testid="tasklist-share-who"]').map((l) => l.text())).toEqual(['Invitation sent to bea@example.test', 'Invitation sent to cy@example.test']);
    expect(w.find('input[data-testid="tasklist-share-person"]').exists()).toBe(true);
  });

  it('closes after removing a person when the answer says the list is not shared any more, whatever the cached count', async () => {
    const CY = { ...BEA, sub: 'sub-cy', name: 'Cy', email: 'cy@example.test' };
    const { w } = await open({
      'GET /api/people': () => ({ people: [] }), 'GET /api/invitations': () => ({ invitations: [], sent: [] }),
      'DELETE /api/tasklists/G/share/sub-bea': () => ({ ...list, id: 'G2' }),
      'GET /api/tasklists/open': () => ({ items: [], finishedToday: [] }),
    });
    // the device still believes two people are on the list; the server has only one left, who is removed now
    useItemsStore().upsert({ ...list, shared: { owned: true, owner: CY, with: [BEA, CY] } } as TaskList);
    await flushPromises();
    await w.get('[data-testid="tasklist-member-remove"]').trigger('click');
    await flushPromises();
    expect(w.emitted('close')).toHaveLength(1);
  });
});
