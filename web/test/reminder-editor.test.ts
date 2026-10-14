import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import type { Reminders } from '@/api/types';

const tid = (id: string) => `[data-testid="${id}"]`;
function editor(modelValue: Reminders, props: Record<string, unknown> = {}) {
  const w = mount(ReminderEditor, { props: { modelValue, prefix: 'e', allowDefault: true, defaultMinutes: [30, 10], ...props, 'onUpdate:modelValue': (v: Reminders) => w.setProps({ modelValue: v }) } });
  return w;
}
const chips = (w: ReturnType<typeof editor>) => w.findAll(tid('e-reminder')).map((c) => [c.attributes('data-minutes'), c.text()]);

describe('ReminderEditor', () => {
  it('shows the calendar default in words and switches to an own list on add', async () => {
    const w = editor({ useDefault: true, minutes: [] });
    expect(w.get(tid('e-reminders-default-list')).text()).toBe('30 min, 10 min');
    expect(w.find(tid('e-reminders-default')).exists()).toBe(false);
    await w.get(tid('e-reminder-add')).trigger('click');
    await w.get('[data-testid="e-reminder-option"][data-minutes="90"]').trigger('click');
    expect(chips(w)).toEqual([['90', '1 h 30 min']]);
    expect(w.find(tid('e-reminders-default')).exists()).toBe(true);
  });

  it('removes a lead, offers no lead twice and goes back to the default or to none', async () => {
    const w = editor({ useDefault: false, minutes: [30, 15] });
    await w.get(tid('e-reminder-add')).trigger('click');
    expect(w.findAll(tid('e-reminder-option')).map((o) => o.attributes('data-minutes'))).not.toContain('30');
    await w.findAll(tid('e-reminder-remove'))[0]!.trigger('click');
    expect(chips(w)).toEqual([['15', '15 min']]);
    await w.get(tid('e-reminders-none')).trigger('click');
    expect(w.find(tid('e-reminder')).exists()).toBe(false);
    await w.get(tid('e-reminder-add')).trigger('click');
    await w.get(tid('e-reminder-option')).trigger('click');
    await w.get(tid('e-reminders-default')).trigger('click');
    expect(w.find(tid('e-reminders-state')).exists()).toBe(true);
  });

  it('stops at five and takes a custom number of minutes', async () => {
    const w = editor({ useDefault: false, minutes: [5, 10, 15, 30] });
    await w.get(tid('e-reminder-add')).trigger('click');
    await w.get(`${tid('e-reminder-custom')}`).setValue('45');
    await w.get(tid('e-reminder-custom-add')).trigger('click');
    expect(chips(w).map((c) => c[0])).toEqual(['5', '10', '15', '30', '45']);
    expect(w.get(tid('e-reminder-add')).attributes('disabled')).toBeDefined();
  });

  it('refuses a custom value Google would not take', async () => {
    const w = editor({ useDefault: false, minutes: [] });
    await w.get(tid('e-reminder-add')).trigger('click');
    await w.get(tid('e-reminder-custom')).setValue('50000');
    await w.get(tid('e-reminder-custom-add')).trigger('click');
    expect(chips(w)).toEqual([]);
    expect(w.text()).toContain('Enter minutes from 0 to 40320');
  });

  it('is read-only without add and remove controls', () => {
    const w = editor({ useDefault: false, minutes: [10] }, { readonly: true, allowDefault: false });
    expect(chips(w)).toEqual([['10', '10 min']]);
    expect(w.find(tid('e-reminder-add')).exists()).toBe(false);
    expect(w.find(tid('e-reminder-remove')).exists()).toBe(false);
  });
});
