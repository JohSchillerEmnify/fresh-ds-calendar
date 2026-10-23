import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Snackbar from '@/components/m3/Snackbar.vue';
import { useUiStore } from '@/stores/ui';
import { freshPinia } from './helpers';

describe('a counting-down snackbar (feature reminders)', () => {
  it('shows every new text but gives screen readers its first one only', async () => {
    const pinia = freshPinia();
    const w = mount(Snackbar, { global: { plugins: [pinia] } });
    const ui = useUiStore();
    const id = ui.notify('Dentist starts in 30 min', { duration: 0, announce: 'Dentist starts in 30 min' });
    ui.update(id, 'Dentist starts in 29 min');
    await w.vm.$nextTick();
    const msg = w.get('[data-testid="snackbar-text"]');
    expect(msg.text()).toBe('Dentist starts in 29 min');
    expect(msg.attributes('aria-hidden')).toBe('true');
    expect(w.get('.sr-only').text()).toBe('Dentist starts in 30 min');
    // an ordinary snackbar is read as it is
    ui.notify('Saved');
    await w.vm.$nextTick();
    expect(w.findAll('[data-testid="snackbar-text"]')[1]!.attributes('aria-hidden')).toBeUndefined();
    w.unmount();
  });
});
