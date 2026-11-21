/** Invitations to share (feature shared-lists, ADR 0047): the cards in the Tasks view, answering them, and the snackbar on arrival. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import InvitationCards from '@/features/tasklists/InvitationCards.vue';
import { useInvitationAnnouncer } from '@/features/tasklists/invitationAnnouncer';
import { useDeviceStore } from '@/stores/device';
import { useUiStore } from '@/stores/ui';
import { changesFixture, freshPinia, mockFetch } from './helpers';

const LIST = { id: 'i1', kind: 'list', title: 'Groceries', from: 'jo@example.test', expires: '2026-10-19T08:00:00+02:00' };
const CATEGORY = { id: 'i2', kind: 'category', title: 'Shopping', from: 'jo@example.test', expires: '2026-10-19T08:00:00+02:00' };
const invitations = (...invitations: unknown[]) => ({ invitations, sent: [] });

let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

function device(files: Record<string, unknown>) {
  const d = useDeviceStore();
  d.take(changesFixture({ files }) as never);
  return d;
}

describe('the invitation cards', () => {
  it('shows the invitations the device copy holds while offline', async () => {
    mockFetch({});
    const pinia = freshPinia();
    device({ invitations: invitations(LIST, CATEGORY) });
    wrapper = mount(InvitationCards, { global: { plugins: [pinia] } });
    const cards = wrapper.findAll('[data-testid="invitation-card"]');
    expect(cards.map((c) => [c.attributes('data-kind'), c.attributes('data-title')])).toEqual([['list', 'Groceries'], ['category', 'Shopping']]);
    expect(cards[0]!.text()).toContain('Invitation to a task list');
    expect(cards[0]!.text()).toContain('jo@example.test invites you to share “Groceries”.');
    expect(cards[1]!.text()).toContain('Invitation to a category');
    expect(cards[0]!.find('[data-testid="invitation-accept"]').text()).toBe('Accept');
    expect(cards[0]!.find('[data-testid="invitation-decline"]').text()).toBe('Decline');
  });

  it('shows nothing without invitations', () => {
    mockFetch({});
    const pinia = freshPinia();
    device({});
    wrapper = mount(InvitationCards, { global: { plugins: [pinia] } });
    expect(wrapper.find('[data-testid="invitations"]').exists()).toBe(false);
  });

  it('accepting asks the server, takes the card away and syncs', async () => {
    const { calls } = mockFetch({
      'POST /api/invitations/i1/accept': () => ({ listId: 'shared:x' }),
      'GET /api/config': () => ({ status: 503, body: { error: { code: 'X', message: 'down' } } }),
    });
    const pinia = freshPinia();
    device({ invitations: invitations(LIST, CATEGORY) });
    wrapper = mount(InvitationCards, { global: { plugins: [pinia] } });
    await wrapper.get('[data-testid="invitation-accept"]').trigger('click');
    await flushPromises();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/invitations/i1/accept')).toBe(true);
    expect(wrapper.findAll('[data-testid="invitation-card"]').map((c) => c.attributes('data-title'))).toEqual(['Shopping']);
  });

  it('declining asks the server and takes the card away', async () => {
    const { calls } = mockFetch({ 'POST /api/invitations/i1/decline': () => ({ ok: true }) });
    const pinia = freshPinia();
    device({ invitations: invitations(LIST) });
    wrapper = mount(InvitationCards, { global: { plugins: [pinia] } });
    await wrapper.get('[data-testid="invitation-decline"]').trigger('click');
    await flushPromises();
    expect(calls.some((c) => c.path === '/api/invitations/i1/decline')).toBe(true);
    expect(wrapper.find('[data-testid="invitation-card"]').exists()).toBe(false);
  });

  it('keeps the card and says so when the answer does not get through', async () => {
    mockFetch({ 'POST /api/invitations/i1/accept': () => ({ status: 503, body: { error: { code: 'UNAVAILABLE', message: 'down' } } }) });
    const pinia = freshPinia();
    device({ invitations: invitations(LIST) });
    wrapper = mount(InvitationCards, { global: { plugins: [pinia] } });
    await wrapper.get('[data-testid="invitation-accept"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="invitation-card"]').exists()).toBe(true);
    expect(useUiStore().snackbars).toHaveLength(1);
  });
});

describe('the snackbar on arrival', () => {
  async function host() {
    mockFetch({});
    const pinia = freshPinia();
    const router = createAppRouter(createMemoryHistory());
    router.push('/week/2026-10-12');
    await router.isReady();
    const d = device({});
    wrapper = mount(defineComponent({ setup() { useInvitationAnnouncer(); return () => h('div'); } }), { global: { plugins: [pinia, router] } });
    return { d, router, ui: useUiStore() };
  }

  it('names the sender and the list, once, and Show opens the Tasks view', async () => {
    const { d, router, ui } = await host();
    expect(ui.snackbars).toHaveLength(0);
    d.putFile('invitations', invitations(LIST));
    await flushPromises();
    expect(ui.snackbars.map((s) => [s.text, s.action?.label])).toEqual([['jo@example.test invites you to share “Groceries”', 'Show']]);
    // the same invitation arriving again with the next sync says nothing new
    d.putFile('invitations', invitations({ ...LIST }));
    await flushPromises();
    expect(ui.snackbars).toHaveLength(1);
    ui.snackbars[0]!.action!.run();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/tasks'));
  });

  it('does not announce again after a reload of the app', async () => {
    const { d, ui } = await host();
    d.putFile('invitations', invitations(LIST));
    await flushPromises();
    const kept = d.file('invitationsAnnounced');
    expect(kept).toEqual(['i1']);
    wrapper!.unmount();
    mockFetch({});
    const pinia = freshPinia();
    const router = createAppRouter(createMemoryHistory());
    // the device copy comes back from the device's own storage with what it kept
    device({ invitations: invitations(LIST), invitationsAnnounced: kept });
    wrapper = mount(defineComponent({ setup() { useInvitationAnnouncer(); return () => h('div'); } }), { global: { plugins: [pinia, router] } });
    await flushPromises();
    expect(useUiStore().snackbars).toHaveLength(0);
  });

  it('names a category invitation as one', async () => {
    const { d, ui } = await host();
    d.putFile('invitations', invitations(CATEGORY));
    await flushPromises();
    expect(ui.snackbars[0]!.text).toBe('jo@example.test invites you to share the category “Shopping”');
  });
});
