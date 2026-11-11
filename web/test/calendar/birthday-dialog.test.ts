import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import type { CalendarEvent } from '@/api/types';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import EventDialog from '@/features/calendar/EventDialog.vue';
import { config, freshPinia, mockFetch, settingsFixture } from '../helpers';

const tid = (id: string) => `[data-testid="${id}"]`;
const anna: CalendarEvent = {
  kind: 'event', id: 'b1_20261015', calendarId: 'primary', title: 'Anna', description: '', location: '', allDay: true, start: '2026-10-15', end: '2026-10-16',
  colorId: null, color: '#039be5', special: 'birthday', dateLocked: true, reminders: { useDefault: true, minutes: [] }, etag: '"1"', updated: '',
};

let wrapper: VueWrapper | null = null;
async function open(props: Record<string, unknown>, ev?: CalendarEvent) {
  mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture(), 'GET /api/calendars': () => ({ calendars: [] }) });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  const router = createAppRouter(createMemoryHistory());
  router.push('/month/2026-10');
  await router.isReady();
  if (ev) useItemsStore().upsert(ev);
  wrapper = mount(EventDialog as never, { props, global: { plugins: [pinia as never, router] }, attachTo: document.body } as never);
  await flushPromises();
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

describe('event dialog in birthday mode', () => {
  it('a new birthday asks for name, date and colour only', async () => {
    await open({ mode: 'create', birthday: true, date: '2026-10-15' });
    expect(document.querySelector(tid('birthday-dialog'))).not.toBeNull();
    for (const id of ['birthday-name', 'birthday-date', 'event-color', 'birthday-save']) expect(document.querySelector(tid(id)), id).not.toBeNull();
    for (const id of ['event-all-day', 'event-location', 'event-calendar', 'event-reminders']) expect(document.querySelector(tid(id)), id).toBeNull();
    expect(document.querySelector(tid('event-delete'))).toBeNull();
  });

  it('a birthday linked to a contact has a locked date and an editable name', async () => {
    await open({ id: anna.id }, anna);
    expect(document.querySelector<HTMLInputElement>(tid('birthday-date'))!.disabled).toBe(true);
    expect(document.querySelector(tid('birthday-date-locked'))).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>(tid('birthday-name'))!.disabled).toBe(false);
    expect(document.querySelector(tid('event-delete'))).not.toBeNull();
  });

  it('a read-only birthday opens as plain details', async () => {
    await open({ id: anna.id }, { ...anna, readOnly: true });
    expect(document.querySelector(tid('event-readonly'))).not.toBeNull();
    expect(document.querySelector(tid('birthday-name'))).toBeNull();
  });

  describe('a date read from Google Contacts', () => {
    const fromContacts = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
      ...anna, id: 'contact:people/c1:b:2026-10-14', calendarId: 'birthdays', start: '2026-10-14', end: '2026-10-15', dateLocked: undefined,
      readOnly: true, readOnlyReason: { kind: 'contact' }, contactBirthday: { resourceName: 'people/c1', birthYear: 1990 }, ...over,
    });

    it('shows the age of a birthday with a year and the hint to change it in Google Contacts, and no way to save or delete', async () => {
      await open({ id: 'contact:people/c1:b:2026-10-14' }, fromContacts());
      expect(document.querySelector(tid('birthday-age'))!.textContent).toBe('Turns 36');
      expect(document.querySelector(tid('event-readonly-hint'))!.textContent).toBe('Change this birthday in Google Contacts');
      for (const id of ['event-save', 'event-delete', 'event-reminders']) expect(document.querySelector(tid(id)), id).toBeNull();
    });

    it('shows no age without a year, for an anniversary or for another date', async () => {
      for (const over of [{ contactBirthday: { resourceName: 'people/c1' } }, { special: 'anniversary' as const }, { special: undefined }]) {
        await open({ id: 'contact:people/c1:b:2026-10-14' }, fromContacts(over));
        expect(document.querySelector(tid('birthday-age')), JSON.stringify(over)).toBeNull();
        expect(document.querySelector(tid('event-readonly-hint'))).not.toBeNull();
        wrapper?.unmount();
        document.body.innerHTML = '';
      }
    });
  });
});
