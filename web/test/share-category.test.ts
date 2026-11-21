/** The category dialog's "Share with" is an email field too; a typed address sends an invitation, which then shows as a pending line (feature shared-lists, ADR 0047). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CategoryDialog from '@/components/settings/CategoryDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { useDeviceStore } from '@/stores/device';
import { useSettingsStore } from '@/stores/settings';
import { freshPinia, mockFetch, settingsFixture } from './helpers';

const category = { id: 'shopping', name: 'Shopping', color: '#112233', icon: null } as never;
let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

async function open(shares: unknown, more: Record<string, () => unknown> = {}) {
  const { calls } = mockFetch({
    'GET /api/settings': () => settingsFixture(), 'GET /api/people': () => ({ people: [] }), 'GET /api/categories/shares': () => ({ shares: {} }),
    'PATCH /api/categories/shopping': () => settingsFixture(), 'PUT /api/categories/shopping/share': () => ({ shares }),
    'GET /api/invitations': () => ({ invitations: [], sent: [] }), ...more,
  });
  const pinia = freshPinia();
  useAuthStore().status = 'in';
  await useSettingsStore().load();
  useDeviceStore().take({
    full: true, cursor: 'c1', window: { from: '2020-01-01', to: '2030-01-01' }, calendars: [],
    events: { calendars: [], replace: [], series: [], removed: [], upserts: [], failed: [] },
    taskLists: { replace: true, series: [], removed: [], upserts: [], failed: false }, files: {},
  } as never);
  wrapper = mount(CategoryDialog, { props: { category }, global: { plugins: [pinia] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, calls, device: useDeviceStore() };
}

describe('Share with in the category dialog', () => {
  it('sends the typed address as an invitation and closes', async () => {
    const { w, calls } = await open({});
    expect(w.get('input[data-testid="category-share-person"]').attributes('type')).toBe('email');
    await w.get('input[data-testid="category-share-person"]').setValue('Bea@example.test');
    await w.get('[data-testid="category-save"]').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.path === '/api/categories/shopping/share')?.body).toEqual({ email: 'bea@example.test' });
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('shows the pending invitation instead of the field and withdraws it', async () => {
    const { w, calls, device } = await open({}, { 'POST /api/invitations/i1/withdraw': () => ({ ok: true }) });
    device.putFile('invitations', { invitations: [], sent: [{ id: 'i1', kind: 'category', target: 'shopping', address: 'bea@example.test', expires: 'x' }] });
    await flushPromises();
    expect(w.get('[data-testid="category-share-who"]').text()).toBe('Invitation sent to bea@example.test');
    expect(w.find('input[data-testid="category-share-person"]').exists()).toBe(false);
    await w.get('[data-testid="category-invite-withdraw"]').trigger('click');
    await flushPromises();
    expect(calls.some((c) => c.path === '/api/invitations/i1/withdraw')).toBe(true);
    expect(w.find('input[data-testid="category-share-person"]').exists()).toBe(true);
    expect(w.emitted('close')).toBeUndefined();
  });
});
