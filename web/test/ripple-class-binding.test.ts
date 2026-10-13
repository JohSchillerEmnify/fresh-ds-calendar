// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref, withDirectives } from 'vue';
import { mount } from '@vue/test-utils';
import { vRipple } from '@/lib/ripple';
import NavigationBar from '@/components/m3/NavigationBar.vue';

// `.m3-state` supplies `position: relative`; without it a ripple positions against an outer ancestor.
describe('v-ripple survives :class re-renders', () => {
  it('keeps m3-state when the bound class changes, and the ripple stays inside the element', async () => {
    const active = ref(false);
    const C = defineComponent({
      setup: () => () => withDirectives(h('button', { class: { dest: true, active: active.value } }), [[vRipple]]),
    });
    const w = mount(C, { attachTo: document.body });
    const el = w.element as HTMLElement;
    expect(el.classList.contains('m3-state')).toBe(true);
    active.value = true;
    await w.vm.$nextTick();
    expect(el.classList.contains('active')).toBe(true);
    expect(el.classList.contains('m3-state')).toBe(true);
    active.value = false;
    await w.vm.$nextTick();
    expect(el.classList.contains('m3-state')).toBe(true);
    el.dispatchEvent(new Event('pointerdown'));
    const ripple = el.querySelector('.m3-ripple');
    expect(ripple?.parentElement).toBe(el);
    w.unmount();
  });

  it('NavigationBar: tapped and previously active tabs keep m3-state after the selection changes', async () => {
    const Icon = defineComponent({ render: () => h('svg') });
    const items = ['year', 'month', 'week', 'day'].map((id) => ({ id, label: id, icon: Icon, testid: `tab-${id}` }));
    const w = mount(NavigationBar, { props: { items, modelValue: 'year' }, attachTo: document.body });
    const tab = (id: string) => w.get(`[data-testid="tab-${id}"]`);
    await tab('week').trigger('pointerdown');
    await w.setProps({ modelValue: 'week' });
    expect(tab('week').classes()).toContain('active');
    for (const id of ['year', 'month', 'week', 'day']) expect(tab(id).classes()).toContain('m3-state');
    expect(tab('week').element.querySelectorAll('.m3-ripple').length).toBe(1);
    w.unmount();
  });
});
