/** The event dialog with a picked place: saving it, showing it again, the map and the field order (feature event-location). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import EventDialog from '@/features/calendar/EventDialog.vue';
import LocationField from '@/features/calendar/LocationField.vue';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { config, freshPinia, mockFetch, settingsFixture } from '../helpers';
import { ev, t } from './helpers';

const tid = (id: string) => `[data-testid="${id}"]`;
const $ = (id: string) => document.body.querySelector<HTMLElement>(tid(id));
const cals = { calendars: [{ id: 'primary', name: 'Personal', color: '#039be5', primary: true, writable: true, own: true }] };
const weber = { name: 'Zahnarztpraxis Dr. Weber', lat: 52.4867, lon: 13.3536 };
const address = 'Hauptstraße 12, 10827 Berlin';
const at = `${weber.name}, ${address}`;
const dentist = ev('dentist', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { title: 'Dentist', location: at, place: weber });
const plain = ev('plain', t('2026-10-14', '11:00'), t('2026-10-14', '12:00'), { title: 'Call' });

async function open(props: Record<string, unknown>, routes: Record<string, () => unknown> = {}) {
  const pinia = freshPinia();
  const m = mockFetch({ 'GET /api/config': () => config(), 'GET /api/calendars': () => cals, ...routes } as never);
  await useClockStore().load();
  useSettingsStore().settings = settingsFixture();
  const items = useItemsStore();
  items.upsert(dentist);
  items.upsert(plain);
  const w = mount(EventDialog, { props, global: { plugins: [pinia] }, attachTo: document.body });
  await flushPromises();
  return { w, m, items };
}
/** The form's fields in document order, by their `data-field` names. */
const fieldOrder = () => [...document.body.querySelectorAll('[data-testid="event-dialog"] [data-field]')].map((e) => e.getAttribute('data-field'));

describe('event dialog with a place', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Element.prototype.scrollIntoView = vi.fn(); // jsdom has no layout
  });

  it('saves a picked place: Google gets "<name>, <address>", the event keeps the place', async () => {
    const { w, m } = await open({ mode: 'create', date: '2026-10-14', time: '09:00' }, { 'POST /api/events': () => ({ status: 201, body: dentist }) });
    await w.get(tid('event-title')).setValue('Dentist');
    const field = w.findComponent(LocationField);
    field.vm.$emit('update:modelValue', weber.name);
    field.vm.$emit('update:place', { ...weber, address });
    await flushPromises();
    expect($('event-location-address')?.textContent).toBe(address);
    expect($('event-map')?.dataset.lat).toBe('52.4867');
    // the new map is brought into view above the dialog's actions
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    expect(m.calls.find((c) => c.method === 'POST')!.body).toMatchObject({ location: at, place: weber });
  });

  it('keeps typed text as it is, without a place and without a map', async () => {
    const { w, m } = await open({ mode: 'create', date: '2026-10-14', time: '09:00' }, { 'POST /api/events': () => ({ status: 201, body: plain }) });
    await w.get(tid('event-title')).setValue('Dentist');
    await w.get(tid('event-location')).setValue('Zahnarzt am Markt');
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    const body = m.calls.find((c) => c.method === 'POST')!.body;
    expect(body.location).toBe('Zahnarzt am Markt');
    expect(body.place).toBeNull();
    expect($('event-map')).toBeNull();
  });

  it('opens a saved place with its name in the field, the address under it and the map, right under the title', async () => {
    await open({ id: 'dentist' });
    expect((document.body.querySelector(tid('event-location')) as HTMLInputElement).value).toBe(weber.name);
    expect($('event-location-address')?.textContent).toBe(address);
    expect($('event-map')?.dataset.lon).toBe('13.3536');
    expect(fieldOrder().slice(0, 2)).toEqual(['title', 'location']);
  });

  it('keeps the location after the reminders for a new event and an event without a location', async () => {
    await open({ mode: 'create', date: '2026-10-14', time: '09:00' });
    expect(fieldOrder().indexOf('location')).toBe(fieldOrder().indexOf('description') - 1);
    document.body.innerHTML = '';
    await open({ id: 'plain' });
    expect(fieldOrder().indexOf('location')).toBe(fieldOrder().indexOf('description') - 1);
  });

  it('changing the text of a picked place drops the place and its map; only the change is sent', async () => {
    const { w, m } = await open({ id: 'dentist' }, { 'PATCH /api/events/dentist': () => ({ body: { ...dentist, location: 'Zahnarzt am Markt', place: undefined } }) });
    await w.get(tid('event-location')).setValue('Zahnarzt am Markt');
    expect($('event-map')).toBeNull();
    expect($('event-location-address')).toBeNull();
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    expect(m.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ location: 'Zahnarzt am Markt', place: null });
  });

  it('never cuts a location changed elsewhere back to the place name: changing a reminder sends no location', async () => {
    const halle = { ...dentist, id: 'halle', location: 'Zahnarztpraxis Dr. Weber (Halle 2)' };
    const { w, m } = await open({ id: 'halle' }, { 'GET /api/events/halle': () => halle, 'PATCH /api/events/halle': () => ({ body: halle }) });
    expect((document.body.querySelector(tid('event-location')) as HTMLInputElement).value).toBe('Zahnarztpraxis Dr. Weber (Halle 2)');
    expect($('event-map')).toBeNull();
    await w.get('button[data-testid="event-reminders-none"]').trigger('click');
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    const body = m.calls.find((c) => c.method === 'PATCH')!.body;
    expect(body.location).toBeUndefined();
    expect(body.reminders).toEqual({ useDefault: false, minutes: [] });
  });

  it('a typed location clears a place Google may still hold', async () => {
    const { w, m } = await open({ id: 'plain' }, { 'PATCH /api/events/plain': () => ({ body: plain }) });
    await w.get(tid('event-location')).setValue('Zahnarzt am Markt');
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    expect(m.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ location: 'Zahnarzt am Markt', place: null });
  });

  it('sends nothing for an opened place that was not changed', async () => {
    const { w, m } = await open({ id: 'dentist' });
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    expect(m.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('shows the map of a read-only event with a place', async () => {
    const ro = { ...dentist, id: 'ro', readOnly: true, readOnlyReason: { kind: 'calendar', by: 'anna@example.test' } };
    await open({ id: 'ro' }, { 'GET /api/events/ro': () => ro });
    expect($('event-readonly-location')?.textContent).toContain(weber.name);
    expect($('event-location-address')?.textContent).toBe(address);
    expect($('event-map')?.dataset.lat).toBe('52.4867');
  });
});
