// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import MenuField from '@/components/m3/MenuField.vue';

const options = [{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }];
let w: VueWrapper | null = null;
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = ''; });
const field = () => mount(MenuField, { props: { modelValue: 'month', options, label: 'Default view' }, attachTo: document.body });

describe('MenuField', () => {
  it('shows the chosen option in an outlined field that opens a listbox', async () => {
    w = field();
    expect(w.get('button').attributes('aria-haspopup')).toBe('listbox');
    expect(w.get('.val').text()).toBe('Month');
    await w.get('button').trigger('click');
    expect(w.findAll('[role="option"]').map((o) => o.text())).toEqual(['Month', 'Week']);
    expect(w.get('[aria-selected="true"]').text()).toBe('Month');
  });

  it('puts the focus on the chosen option when it opens', async () => {
    w = mount(MenuField, { props: { modelValue: 'week', options, label: 'Default view' }, attachTo: document.body });
    await w.get('button').trigger('click');
    await nextTick();
    await nextTick();
    expect(document.activeElement?.textContent?.trim()).toBe('Week');
  });

  it('emits the chosen option and closes the menu', async () => {
    w = field();
    await w.get('button').trigger('click');
    await w.findAll('[role="option"]')[1].trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['week']]);
    expect(w.find('[role="listbox"]').exists()).toBe(false);
  });

  it('closes on Escape without a change', async () => {
    w = field();
    await w.get('button').trigger('click');
    await nextTick();
    await w.get('[role="listbox"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="listbox"]').exists()).toBe(false);
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
});
