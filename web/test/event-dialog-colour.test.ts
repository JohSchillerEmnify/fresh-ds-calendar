/** The event dialog's "Calendar color" swatch shows the chosen calendar's real colour, not a fixed fallback. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import EventDialog from '@/features/calendar/EventDialog.vue';
import { calendars } from '@/features/calendar/calendars';
import { freshPinia, mockFetch } from './helpers';

vi.hoisted(() => {
  globalThis.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof matchMedia;
});

const cal = (id: string, name: string, color: string, primary = false) => ({ id, name, color, primary, own: true, writable: true, hidden: false, defaultReminders: [] });

describe('the event dialog calendar colour', () => {
  beforeEach(() => {
    freshPinia();
    calendars.value = [];
    mockFetch({
      'GET /api/calendars': () => ({ calendars: [cal('work@example.test', 'Work', '#0b8043'), cal('me@example.test', 'Me', '#8e24aa', true)] }),
    });
  });

  const open = async () => {
    const w = mount(EventDialog, { props: { mode: 'create', date: '2026-10-12' }, attachTo: document.body });
    await vi.waitFor(() => expect(calendars.value).toHaveLength(2));
    await flushPromises();
    return w;
  };
  const swatch = (w: ReturnType<typeof mount>) => w.get('[data-testid=event-color-option]').attributes('data-color');

  it('shows the colour of the initially chosen primary calendar', async () => {
    expect(swatch(await open())).toBe('#8e24aa');
  });

  it('follows the calendar when another one is chosen', async () => {
    const w = await open();
    await w.get('[data-testid=event-calendar]').setValue('work@example.test');
    expect(swatch(w)).toBe('#0b8043');
  });
});
