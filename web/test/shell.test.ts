import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '@/App.vue';
import { createAppRouter } from '@/router';

async function mountAt(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] } });
  await flushPromises();
  await vi.waitFor(() => expect(wrapper.find('[data-testid$="-view"]').exists()).toBe(true));
  return { wrapper, router };
}

describe('app shell', () => {
  it('renders month view with Monday-first grid', async () => {
    const { wrapper } = await mountAt('/month/2026-10');
    expect(wrapper.get('[data-testid="period-label"]').text()).toBe('October 2026');
    expect(wrapper.findAll('[data-testid="weekday-header"]')[0].text()).toBe('Mon');
    expect(wrapper.find('[data-testid="month-cell-2026-09-28"]').exists()).toBe(true);
  });

  it('navigates with next and switches tabs', async () => {
    const { wrapper, router } = await mountAt('/month/2026-10');
    await wrapper.get('[data-testid="nav-next"]').trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/month/2026-11'));
    await wrapper.get('[data-testid="tab-week"]').trigger('click');
    // views are lazy-loaded chunks: wait for navigation + render
    await vi.waitFor(() => expect(router.currentRoute.value.path).toMatch(/^\/week\/2026-11-/));
    await vi.waitFor(() => expect(wrapper.find('[data-testid="week-view"]').exists()).toBe(true));
  });

  it('redirects invalid dates to the current period', async () => {
    const { router } = await mountAt('/day/not-a-date');
    expect(router.currentRoute.value.path).toMatch(/^\/day\/\d{4}-\d{2}-\d{2}$/);
  });

  it('opens the create sheet from the FAB', async () => {
    const { wrapper } = await mountAt('/day/2026-10-12');
    await wrapper.get('[data-testid="fab-create"]').trigger('click');
    expect(wrapper.find('[data-testid="create-sheet"]').exists()).toBe(true);
  });
});
