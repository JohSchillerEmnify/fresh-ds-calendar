/** The category dialog's "Share with" is an email field too, and an address that names nobody changes nothing (feature shared-lists, ADR 0046). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CategoryDialog from '@/components/settings/CategoryDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { freshPinia, mockFetch, settingsFixture } from './helpers';

const category = { id: 'shopping', name: 'Shopping', color: '#112233', icon: null } as never;
let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

async function open(shares: unknown) {
  const { calls } = mockFetch({
    'GET /api/settings': () => settingsFixture(), 'GET /api/people': () => ({ people: [] }), 'GET /api/categories/shares': () => ({ shares: {} }),
    'PATCH /api/categories/shopping': () => settingsFixture(), 'PUT /api/categories/shopping/share': () => ({ shares }),
  });
  const pinia = freshPinia();
  useAuthStore().status = 'in';
  await useSettingsStore().load();
  wrapper = mount(CategoryDialog, { props: { category }, global: { plugins: [pinia] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, calls };
}

describe('Share with in the category dialog', () => {
  it('sends the typed address and stays open with the neutral note when it names nobody', async () => {
    const { w, calls } = await open({});
    expect(w.get('input[data-testid="category-share-person"]').attributes('type')).toBe('email');
    await w.get('input[data-testid="category-share-person"]').setValue('Nobody@example.test');
    await w.get('[data-testid="category-save"]').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.path === '/api/categories/shopping/share')?.body).toEqual({ email: 'nobody@example.test' });
    expect(w.get('[data-testid="category-share-note"]').text()).toBe("If this person uses the calendar, they'll see the list.");
    expect(w.emitted('close')).toBeUndefined();
  });

  it('closes when the address named a person', async () => {
    const { w } = await open({ shopping: { sub: 's', name: 'Bea', email: 'bea@example.test', initial: 'B' } });
    await w.get('input[data-testid="category-share-person"]').setValue('bea@example.test');
    await w.get('[data-testid="category-save"]').trigger('click');
    await flushPromises();
    expect(w.emitted('close')).toHaveLength(1);
  });
});
