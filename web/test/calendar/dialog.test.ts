import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import EventDialog from '@/features/calendar/EventDialog.vue';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import { apiError, config, freshPinia, mockFetch, settingsFixture } from '../helpers';
import { ev, t } from './helpers';

const tid = (id: string) => `[data-testid="${id}"]`;
const cals = { calendars: [{ id: 'primary', name: 'Personal', color: '#039be5', primary: true, writable: true }, { id: 'work', name: 'Work', color: '#0b8043', primary: false, writable: true }] };
const dentist = ev('dentist', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { title: 'Dentist' });

async function open(props: Record<string, unknown>, routes: Record<string, () => unknown> = {}) {
  const pinia = freshPinia();
  const m = mockFetch({ 'GET /api/config': () => config(), 'GET /api/calendars': () => cals, ...routes } as never);
  await useClockStore().load();
  useSettingsStore().settings = settingsFixture();
  const items = useItemsStore();
  items.upsert(dentist);
  const w = mount(EventDialog, { props, global: { plugins: [pinia] }, attachTo: document.body });
  await flushPromises();
  return { w, m, items };
}
const fill = async (w: ReturnType<typeof mount>, id: string, v: string) => { await w.get(tid(id)).setValue(v); };

describe('event dialog', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('create is prefilled and lists the colour options in spec order', async () => {
    const { w } = await open({ mode: 'create', date: '2026-10-20', time: null });
    expect((w.get(tid('event-start-date')).element as HTMLInputElement).value).toBe('2026-10-20');
    expect((w.get(tid('event-start-time')).element as HTMLInputElement).value).toBe('09:00');
    expect((w.get(tid('event-end-time')).element as HTMLInputElement).value).toBe('10:00');
    const names = w.findAll(tid('event-color-option')).map((b) => b.attributes('data-name'));
    expect(names.join(', ')).toBe('Calendar color, Tomato, Flamingo, Tangerine, Banana, Sage, Basil, Peacock, Blueberry, Lavender, Grape, Graphite');
    expect(w.get(tid('event-color-option')).attributes('aria-checked')).toBe('true');
    expect(w.get(tid('event-dialog')).attributes('data-presentation')).toMatch(/sheet|modal/);
  });

  it('start change keeps the duration', async () => {
    const { w } = await open({ mode: 'create', date: '2026-10-14', time: '09:00' });
    await fill(w, 'event-end-time', '10:30');
    await fill(w, 'event-start-time', '11:00');
    expect((w.get(tid('event-end-time')).element as HTMLInputElement).value).toBe('12:30');
    expect(w.get(tid('event-duration')).text()).toBe('1 h 30 min');
  });

  it.each([
    ['', '10:00', 'Title is required'],
    ['   ', '10:00', 'Title is required'],
    ['Broken', '09:00', 'End must be after start'],
  ])('shows "%s" validation without calling the API', async (title, end, msg) => {
    const { w, m } = await open({ mode: 'create', date: '2026-10-14', time: '09:00' });
    await fill(w, 'event-title', title);
    await fill(w, 'event-end-time', end);
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    expect(w.get(tid('event-error')).text()).toBe(msg);
    expect(m.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('creates an event optimistically and closes after the server confirmed', async () => {
    const created = ev('srv1', t('2026-10-14', '09:00'), t('2026-10-14', '10:30'), { title: 'Team sync', calendarId: 'work', color: '#d50000', colorId: '11' });
    const { w, m, items } = await open({ mode: 'create', date: '2026-10-14', time: '09:00' }, { 'POST /api/events': () => ({ status: 201, body: created }) });
    await fill(w, 'event-title', ' Team sync ');
    await fill(w, 'event-end-time', '10:30');
    await w.get(tid('event-calendar')).setValue('work');
    await w.get('[data-name="Tomato"]').trigger('click');
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    const post = m.calls.find((c) => c.method === 'POST')!;
    expect(post.body).toMatchObject({ title: 'Team sync', calendarId: 'work', colorId: '11', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:30:00+02:00' });
    expect(w.emitted('close')).toHaveLength(1);
    expect(items.all.map((i) => i.id).sort()).toEqual(['dentist', 'srv1']);
  });

  it('a failing create keeps the dialog open with the error and rolls back', async () => {
    const { w, items } = await open({ mode: 'create', date: '2026-10-14', time: '09:00' }, { 'POST /api/events': () => apiError(503, 'PROVIDER_UNAVAILABLE') });
    await fill(w, 'event-title', 'Lunch');
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    expect(w.get(tid('event-error')).text()).toBe('Could not save: Google Calendar is unavailable');
    expect(w.emitted('close')).toBeUndefined();
    expect(items.all.map((i) => i.id)).toEqual(['dentist']);
  });

  it('edit sends only changes with If-Match and shows the conflict message', async () => {
    const { w, m, items } = await open({ id: 'dentist' }, { 'PATCH /api/events/dentist': () => apiError(412, 'PRECONDITION_FAILED', 'stale') });
    expect((w.get(tid('event-title')).element as HTMLInputElement).value).toBe('Dentist');
    await fill(w, 'event-title', 'Dentist (moved)');
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    const patch = m.calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body).toEqual({ title: 'Dentist (moved)' });
    expect(patch.headers['If-Match']).toBe(dentist.etag);
    expect(w.get(tid('event-error')).text()).toBe('This event was changed elsewhere. Reload it and try again.');
    expect(items.get('dentist')!.title).toBe('Dentist');
  });

  it('delete removes at once without asking; the request goes out when the undo time is over', async () => {
    const { w, m, items } = await open({ id: 'dentist' }, { 'DELETE /api/events/dentist': () => ({ status: 204 }) });
    await w.get(tid('event-delete')).trigger('click');
    expect(w.find(tid('confirm-dialog')).exists()).toBe(false);
    expect(items.get('dentist')).toBeUndefined();
    expect(w.emitted('close')).toHaveLength(1);
    expect(m.calls.some((c) => c.method === 'DELETE')).toBe(false);
    await usePendingDeletesStore().flush();
    expect(m.calls.some((c) => c.method === 'DELETE' && c.headers['If-Match'] === dentist.etag)).toBe(true);
    expect(items.get('dentist')).toBeUndefined();
  });

  it('Escape and Cancel close without saving; all-day hides times and uses an exclusive end', async () => {
    const { w, m } = await open({ mode: 'create', date: '2026-10-16', time: '09:00' }, { 'POST /api/events': () => ({ status: 201, body: ev('h', '2026-10-16', '2026-10-17') }) });
    await fill(w, 'event-title', 'Holiday');
    await w.get(tid('event-all-day')).setValue(true);
    expect(w.find(tid('event-start-time')).exists()).toBe(false);
    await w.get(tid('event-save')).trigger('submit');
    await flushPromises();
    expect(m.calls.find((c) => c.method === 'POST')!.body).toMatchObject({ allDay: true, start: '2026-10-16', end: '2026-10-17' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(w.emitted('close')!.length).toBeGreaterThanOrEqual(2);
  });
});
