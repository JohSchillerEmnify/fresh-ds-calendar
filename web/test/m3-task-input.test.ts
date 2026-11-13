// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Checkbox from '@/components/m3/Checkbox.vue';
import ListItem from '@/components/m3/ListItem.vue';
import TextField from '@/components/m3/TextField.vue';
import { clearEffects } from '@/motion/effects';
import { setAnimationSetting, __setSystemReducedForTest } from '@/motion/level';
import { installWaapi, removeWaapi } from './motion/helpers';

beforeEach(() => { installWaapi(); setAnimationSetting('full'); __setSystemReducedForTest(false); });
afterEach(() => { clearEffects(); removeWaapi(); document.body.innerHTML = ''; });

describe('Checkbox', () => {
  it('is a native checkbox named by its label that follows modelValue', async () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Milk done' } });
    const input = w.get('input');
    expect(input.attributes('type')).toBe('checkbox');
    expect(input.attributes('aria-label')).toBe('Milk done');
    expect((input.element as HTMLInputElement).checked).toBe(false);
    await w.setProps({ modelValue: true });
    expect((input.element as HTMLInputElement).checked).toBe(true);
    expect(w.classes()).toContain('is-checked');
  });

  it('emits the tick synchronously and keeps the reward sparkle, only on a tick', async () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Milk' }, attachTo: document.body });
    const input = w.get('input');
    (input.element as HTMLInputElement).checked = true;
    await input.trigger('change');
    expect(w.emitted('update:modelValue')![0]).toEqual([true]);
    expect(w.emitted('change')![0]).toEqual([true]);
    expect(document.querySelector('[data-kind="tick"]')).not.toBeNull();
    clearEffects();
    (input.element as HTMLInputElement).checked = false;
    await input.trigger('change');
    expect(w.emitted('update:modelValue')![1]).toEqual([false]);
    expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    w.unmount();
  });

  it('draws the theme glyphs over an 18 px box with a 40 px state layer behind a 48 px target', () => {
    const w = mount(Checkbox, { props: { modelValue: true, label: 'x' } });
    expect(w.findAll('.rcb-check').map((p) => p.attributes('data-glyph'))).toEqual(['tick', 'bold', 'cross', 'dot']);
    const rect = w.get('rect.rcb-bg');
    // an 18 px outer box: 16 px between the stroke centres plus the 2 px outline (_md-comp-checkbox container-size)
    expect([rect.attributes('width'), rect.attributes('height')]).toEqual(['16', '16']);
    expect(w.find('.cb-layer').exists()).toBe(true);
  });

  it('does nothing while disabled', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'x', disabled: true } });
    expect(w.get('input').attributes('disabled')).toBeDefined();
  });
});

describe('ListItem', () => {
  it('lays out leading, headline, supporting and trailing in order', () => {
    const w = mount(ListItem, {
      props: { tag: 'li' },
      slots: { leading: '<i>L</i>', default: '<b>Head</b>', supporting: 'Sub', trailing: '<i>T</i>' },
    });
    expect(w.element.tagName).toBe('LI');
    expect(w.findAll(':scope > *').map((e) => e.classes()[0])).toEqual(['li-lead', 'li-body', 'li-trail']);
    expect(w.get('.li-body').text()).toBe('HeadSub');
    expect(w.get('.li-sup').text()).toBe('Sub');
  });

  it('leaves out empty slots and is a div by default', () => {
    const w = mount(ListItem, { slots: { default: 'Only' } });
    expect(w.element.tagName).toBe('DIV');
    expect(w.find('.li-lead').exists() || w.find('.li-trail').exists() || w.find('.li-sup').exists()).toBe(false);
  });
});

describe('TextField inline', () => {
  it('has no floating label: the label names the field and a placeholder shows', async () => {
    const w = mount(TextField, { props: { modelValue: '', label: 'New item', inline: true, placeholder: 'Add an item' } });
    const input = w.get('input');
    expect(w.find('label').exists()).toBe(false);
    expect(input.attributes('aria-label')).toBe('New item');
    expect(input.attributes('placeholder')).toBe('Add an item');
    expect(w.classes()).toContain('inline');
    await input.setValue('Milk');
    expect(w.emitted('update:modelValue')![0]).toEqual(['Milk']);
  });

  it('keeps the floating label in the normal mode', () => {
    const w = mount(TextField, { props: { modelValue: '', label: 'Title' } });
    expect(w.get('label').text()).toBe('Title');
    expect(w.get('input').attributes('aria-label')).toBeUndefined();
    expect(w.classes()).not.toContain('inline');
  });
});
