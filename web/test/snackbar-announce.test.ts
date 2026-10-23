import { describe, expect, it } from 'vitest';
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
