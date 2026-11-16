// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Radio from '@/components/m3/Radio.vue';
import CustomColor from '@/components/m3/CustomColor.vue';
import Checkbox from '@/components/m3/Checkbox.vue';

describe('Radio', () => {
  it('is a native radio of its group that follows modelValue', async () => {
    const w = mount(Radio, { props: { modelValue: 'this', value: 'following', name: 'scope', label: 'All following' } });
    const input = w.get('input');
    expect(input.attributes('type')).toBe('radio');
    expect(input.attributes('name')).toBe('scope');
    expect(input.attributes('aria-label')).toBe('All following');
    expect((input.element as HTMLInputElement).checked).toBe(false);
    expect(w.classes()).not.toContain('is-checked');
    await w.setProps({ modelValue: 'following' });
    expect((input.element as HTMLInputElement).checked).toBe(true);
    expect(w.classes()).toContain('is-checked');
  });

  it('emits its own value when chosen', async () => {
    const w = mount(Radio, { props: { modelValue: 'this', value: 'following', name: 'scope' } });
    await w.get('input').trigger('change');
    expect(w.emitted('update:modelValue')![0]).toEqual(['following']);
  });
});

describe('CustomColor', () => {
  it('is the native colour picker, named, emitting the final choice (or each step when live)', async () => {
    const w = mount(CustomColor, { props: { modelValue: '#112233', label: 'Custom colour' }, attrs: { 'data-testid': 'cc' } });
    const input = w.get('input');
    expect(input.attributes('type')).toBe('color');
    expect(input.attributes('aria-label')).toBe('Custom colour');
    expect(input.attributes('data-testid')).toBe('cc');
    (input.element as HTMLInputElement).value = '#AABBCC';
    await input.trigger('input');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    await input.trigger('change');
    expect(w.emitted('update:modelValue')![0]).toEqual(['#aabbcc']);
    await w.setProps({ live: true });
    (input.element as HTMLInputElement).value = '#aabbcc';
    await input.trigger('input');
    expect(w.emitted('update:modelValue')![1]).toEqual(['#aabbcc']);
  });
});

describe('Checkbox colour', () => {
  it('takes a calendar colour for its ticked box', () => {
    const w = mount(Checkbox, { props: { modelValue: true, label: 'Work', color: '#ff0000' } });
    expect(w.attributes('style')).toContain('--cb-c: #ff0000');
    expect(w.attributes('data-color')).toBe('#ff0000');
  });
});
