import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Snackbar from '@/components/m3/Snackbar.vue';
import { useUiStore } from '@/stores/ui';
import { freshPinia } from './helpers';

describe('a counting-down snackbar (feature reminders)', () => {
  it('stays readable for screen readers but is announced when it appears, not on every new minute', async () => {
    const pinia = freshPinia();
    const w = mount(Snackbar, { global: { plugins: [pinia] } });
    const ui = useUiStore();
    const id = ui.notify('Dentist starts in 30 min', { duration: 0, countdown: true });
    ui.update(id, 'Dentist starts in 29 min');
    await w.vm.$nextTick();
    const snack = w.get('[data-testid="snackbar"]');
    const msg = w.get('[data-testid="snackbar-text"]');
    expect(msg.text()).toBe('Dentist starts in 29 min');
    // the text itself is never hidden from assistive technology
    expect(msg.attributes('aria-hidden')).toBeUndefined();
    // its region does not re-announce changes; its appearance in the polite host is announced once
    expect(snack.attributes('aria-live')).toBe('off');
    expect(w.get('.host').attributes('aria-live')).toBe('polite');
    // an ordinary snackbar keeps the live status role's default
    ui.notify('Saved');
    await w.vm.$nextTick();
    expect(w.findAll('[data-testid="snackbar"]')[1]!.attributes('aria-live')).toBeUndefined();
    w.unmount();
  });
});

describe('room for a snackbar that stays (issue 62)', () => {
  const room = () => document.documentElement.style.getPropertyValue('--snack-room');

  it('tells the page how far from the screen bottom the snackbars reach, only while one stays', async () => {
    // jsdom lays nothing out: the host is 56 px tall and sits 80 px above the bottom edge
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(56);
    const style = vi.spyOn(window, 'getComputedStyle').mockReturnValue({ bottom: '80px' } as CSSStyleDeclaration);
    const w = mount(Snackbar, { global: { plugins: [freshPinia()] } });
    const ui = useUiStore();
    await w.vm.$nextTick();
    expect(room()).toBe('0px');
    ui.notify('Saved');
    await w.vm.$nextTick();
    expect(room()).toBe('0px');
    const id = ui.notify('Not saved', { duration: 0 });
    await w.vm.$nextTick();
    expect(room()).toBe('136px');
    ui.dismiss(id);
    await w.vm.$nextTick();
    expect(room()).toBe('0px');
    w.unmount();
    height.mockRestore();
    style.mockRestore();
  });
});
