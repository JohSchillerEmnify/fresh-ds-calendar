import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import RewardCheckbox from '@/motion/RewardCheckbox.vue';
import ProgressRing from '@/motion/ProgressRing.vue';
import { useCelebrate } from '@/motion/useCelebrate';
import { clearEffects } from '@/motion/effects';
import { setAnimationSetting, __setSystemReducedForTest } from '@/motion/level';
import { installWaapi, removeWaapi, finishAll, flush } from './helpers';

beforeEach(() => {
  installWaapi(); setAnimationSetting('full'); __setSystemReducedForTest(false);
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});
afterEach(() => { clearEffects(); removeWaapi(); document.body.innerHTML = ''; });

describe('RewardCheckbox', () => {
  it('emits the change synchronously and sparkles on tick only', async () => {
    const w = mount(RewardCheckbox, { props: { modelValue: false, label: 'Milk' }, attachTo: document.body });
    const input = w.find('input');
    (input.element as HTMLInputElement).checked = true;
    await input.trigger('change');
    expect(w.emitted('update:modelValue')![0]).toEqual([true]);
    expect(w.emitted('change')![0]).toEqual([true]);
    expect(document.querySelector('[data-kind="tick"]')).not.toBeNull();
    finishAll(); await flush();
    expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    await w.setProps({ modelValue: true });
    (input.element as HTMLInputElement).checked = false;
    await input.trigger('change');
    expect(w.emitted('update:modelValue')![1]).toEqual([false]);
    expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    w.unmount();
  });
  it('external value changes never celebrate; Off/Reduced still emit without effects', async () => {
    const w = mount(RewardCheckbox, { props: { modelValue: false, label: 'x' }, attachTo: document.body });
    await w.setProps({ modelValue: true });
    expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    for (const lv of ['reduced', 'off'] as const) {
      setAnimationSetting(lv);
      const i = w.find('input'); (i.element as HTMLInputElement).checked = true; await i.trigger('change');
      expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    }
    expect(w.emitted('change')!.length).toBe(2);
    w.unmount();
  });
});

describe('ProgressRing', () => {
  it('shows rounded percent from done/total and value', () => {
    expect(mount(ProgressRing, { props: { done: 1, total: 3 } }).attributes('data-percent')).toBe('33');
    expect(mount(ProgressRing, { props: { done: 2, total: 3 } }).attributes('data-percent')).toBe('67');
    const w = mount(ProgressRing, { props: { value: 1 } });
    expect(w.attributes('data-percent')).toBe('100');
    expect(w.attributes('aria-valuenow')).toBe('100');
    expect(w.attributes('data-testid')).toBe('tasklist-progress-ring');
    expect(mount(ProgressRing, { props: { done: 0, total: 0 } }).attributes('data-percent')).toBe('0');
  });
});

describe('useCelebrate', () => {
  it('spawns list-complete confetti and bounces the card; nothing at Off', async () => {
    const C = defineComponent({ setup() { const el = ref<HTMLElement | null>(null); const { celebrate } = useCelebrate(el); return () => h('div', { ref: el, onClick: celebrate }); } });
    const w = mount(C, { attachTo: document.body });
    await w.trigger('click');
    expect(document.querySelector('[data-kind="list-complete"]')).not.toBeNull();
    clearEffects();
    setAnimationSetting('off');
    await w.trigger('click');
    expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    w.unmount();
  });
});
