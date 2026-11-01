// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { applyLanguage } from '@/i18n';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import TasksToolbar from '@/features/tasklists/TasksToolbar.vue';
import { usePrefsStore } from '@/stores/prefs';
import { freshPinia } from './helpers';

let w: VueWrapper | null = null;
afterEach(async () => { w?.unmount(); w = null; await applyLanguage('en'); });

function toolbar(categories: string[] = [], when = 'all') {
  const pinia = freshPinia();
  usePrefsStore().tasksFilter = { categories, when } as never;
  w = mount(TasksToolbar, { props: { tab: 'open', allCollapsed: false, canCollapse: true }, global: { plugins: [pinia] } });
  return w;
}

describe('Tasks toolbar accessibility', () => {
  it('is a plain group of buttons (no toolbar role, so no arrow-key promise)', () => {
    const el = toolbar().get('[data-testid="tasks-floating-toolbar"]');
    expect(el.attributes('role')).toBe('group');
  });
  it('the filter button opens a dialog: it is not a toggle, and its name tells how many filters are on', () => {
    const none = toolbar().get('[data-testid="tasks-filter-open"]');
    expect(none.attributes('aria-pressed')).toBeUndefined();
    expect(none.attributes('aria-label')).toBe('Filter');
    w!.unmount();
    const two = toolbar(['a', 'b'], 'today').get('[data-testid="tasks-filter-open"]');
    expect(two.attributes('aria-pressed')).toBeUndefined();
    expect(two.attributes('aria-label')).toBe('Filter, 3 active');
  });
});

describe('SegmentedButton', () => {
  it('emits when the shown option is tapped again, so a size shown by `auto` can be pinned', async () => {
    const s = mount(SegmentedButton, { props: { modelValue: 'compact', options: [{ value: 'expressive', label: 'E' }, { value: 'compact', label: 'C' }], label: 'Size' } });
    await s.findAll('button')[1].trigger('click');
    expect(s.emitted('update:modelValue')).toEqual([['compact']]);
  });
});
