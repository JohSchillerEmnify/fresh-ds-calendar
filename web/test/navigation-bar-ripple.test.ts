// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import NavigationBar from '@/components/m3/NavigationBar.vue';

const Icon = defineComponent({ render: () => h('svg') });
const items = ['year', 'month', 'week', 'day'].map((id) => ({ id, label: id, icon: Icon, testid: `tab-${id}` }));

describe('NavigationBar press feedback', () => {
  it('only the pressed tab gets ripple / data-pressed', async () => {
    const w = mount(NavigationBar, { props: { items, modelValue: 'year' }, attachTo: document.body });
    const tab = (id: string) => w.get(`[data-testid="tab-${id}"]`);
    await tab('week').trigger('pointerdown');
    expect(tab('week').element.querySelectorAll('.m3-ripple').length).toBe(1);
    expect(tab('week').attributes('data-pressed')).toBe('true');
    for (const id of ['year', 'month', 'day']) {
      expect(tab(id).element.querySelectorAll('.m3-ripple').length).toBe(0);
      expect(tab(id).attributes('data-pressed')).toBeUndefined();
    }
    expect(w.element.querySelectorAll('.m3-ripple').length).toBe(1);
    w.unmount();
  });
});
