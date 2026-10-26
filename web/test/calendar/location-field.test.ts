/** The location field with place suggestions (feature event-location). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import LocationField from '@/features/calendar/LocationField.vue';
import type { PlacePick } from '@/features/calendar/place';
import { useClockStore } from '@/stores/clock';
import { config, freshPinia, mockFetch } from '../helpers';

const tid = (id: string) => `[data-testid="${id}"]`;
const weber = { name: 'Zahnarztpraxis Dr. Weber', address: 'Hauptstraße 12, 10827 Berlin', lat: 52.4867, lon: 13.3536 };
const mitte = { name: 'Zahnklinik Mitte', address: 'Friedrichstraße 90, 10117 Berlin', lat: 52.52, lon: 13.388 };
const feature = (p: typeof weber) => {
  const [street, rest] = p.address.split(', ');
  const [postcode, city] = rest!.split(' ');
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { name: p.name, street: street!.replace(/ \d+$/, ''), housenumber: street!.split(' ').at(-1), postcode, city } };
};

/** Photon stand-in: answers the given places for every query; records the requests. */
function photon(places = [weber, mitte], status = 200) {
  const calls: { url: string; signal?: AbortSignal | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, signal: init?.signal });
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: places.map(feature) }), { status });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

/** The field inside a form with a description field, as in the event dialog. */
async function mountField() {
  const pinia = freshPinia();
  mockFetch({ 'GET /api/config': () => config() } as never);
  await useClockStore().load();
  const text = ref('');
  const place = ref<PlacePick | null>(null);
  const Host = defineComponent({
    setup: () => () => h('form', [
      h(LocationField, {
        modelValue: text.value, place: place.value, label: 'Location',
        'onUpdate:modelValue': (v: string) => { text.value = v; }, 'onUpdate:place': (p: PlacePick | null) => { place.value = p; },
      }),
      h('textarea', { 'data-field': 'description' }),
    ]),
  });
  const w = mount(Host, { global: { plugins: [pinia] }, attachTo: document.body });
  return { w, text, place, input: w.get(tid('event-location')) };
}

async function type(input: Awaited<ReturnType<typeof mountField>>['input'], v: string, wait = 150) {
  await input.setValue(v);
  await vi.advanceTimersByTimeAsync(wait);
  await flushPromises();
}

describe('location field', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn(); // jsdom has no layout
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('suggests nothing for fewer than three characters', async () => {
    const calls = photon();
    const { w, input } = await mountField();
    await type(input, 'Za', 1000);
    expect(calls).toHaveLength(0);
    expect(input.attributes('aria-controls')).toBeUndefined();
    expect(w.find(tid('place-suggestions')).exists()).toBe(false);
  });

  it('asks once after a short pause and shows the places with the OpenStreetMap credit', async () => {
    const calls = photon();
    const { w, input } = await mountField();
    await type(input, 'Zah', 100);
    await type(input, 'Zahn', 149);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(calls.map((c) => c.url)).toEqual(['https://photon.test/api?q=Zahn&lang=en&limit=5']);
    const rows = w.findAll(tid('place-suggestion'));
    expect(rows.map((r) => [r.get(tid('place-suggestion-name')).text(), r.get(tid('place-suggestion-address')).text()])).toEqual([[weber.name, weber.address], [mitte.name, mitte.address]]);
    expect(w.get(tid('place-suggestions-credit')).text()).toBe('© OpenStreetMap');
    // the credit is no option: it sits outside the listbox the field controls
    expect(w.get(tid('place-suggestions-credit')).element.closest('[role="listbox"]')).toBeNull();
    expect(input.attributes('aria-controls')).toBe(w.get('[role="listbox"]').attributes('id'));
    expect(input.attributes('aria-expanded')).toBe('true');
    // the list is brought into view above the dialog's actions
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('keeps the shown places while typing and swaps them when the new answer arrives', async () => {
    const calls = photon();
    const { w, input } = await mountField();
    await type(input, 'Zahn');
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (url: string) => {
      calls.push({ url });
      return new Response(JSON.stringify({ features: [feature(mitte)] }));
    });
    await type(input, 'Zahnk', 100);
    expect(w.findAll(tid('place-suggestion-name')).map((r) => r.text())).toEqual([weber.name, mitte.name]);
    await vi.advanceTimersByTimeAsync(50);
    await flushPromises();
    expect(w.findAll(tid('place-suggestion-name')).map((r) => r.text())).toEqual([mitte.name]);
  });

  it('shows a query it has answered before at once, without asking again', async () => {
    const calls = photon();
    const { w, input } = await mountField();
    await type(input, 'Zahn');
    await type(input, 'Zahnk');
    expect(calls).toHaveLength(2);
    await input.setValue('Zahn');
    expect(calls).toHaveLength(2);
    expect(w.findAll(tid('place-suggestion-name')).map((r) => r.text())).toEqual([weber.name, mitte.name]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(2);
  });

  it('forgets the highlight when typing on, so Enter does not pick a stale place', async () => {
    photon();
    const { input, place } = await mountField();
    await type(input, 'Zahn');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.setValue('Zahnk');
    await input.trigger('keydown', { key: 'Enter' });
    expect(place.value).toBeNull();
  });

  it('empties the shown places when the text drops below three characters', async () => {
    photon();
    const { w, input } = await mountField();
    await type(input, 'Zahn');
    expect(w.find(tid('place-suggestions')).exists()).toBe(true);
    await input.setValue('Za');
    expect(w.find(tid('place-suggestions')).exists()).toBe(false);
  });

  it('cancels a search that newer text replaced', async () => {
    const calls = photon();
    let release!: () => void;
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (url: string, init?: RequestInit) => {
      calls.push({ url, signal: init?.signal });
      await new Promise<void>((r) => { release = r; });
      return new Response(JSON.stringify({ features: [feature(mitte)] }));
    });
    const { w, input } = await mountField();
    await type(input, 'Zahn');
    await type(input, 'Zahnarzt');
    expect(calls[0]!.signal?.aborted).toBe(true);
    release();
    await flushPromises();
    expect(w.findAll(tid('place-suggestion-name')).map((r) => r.text())).toEqual([weber.name, mitte.name]);
  });

  it('picks a place: its name in the field, the address under it, the list closed', async () => {
    photon();
    const { w, input, text, place } = await mountField();
    await type(input, 'Zahn');
    await w.findAll(tid('place-suggestion'))[0]!.trigger('click');
    expect(text.value).toBe(weber.name);
    expect(place.value).toEqual(weber);
    expect(w.find(tid('place-suggestions')).exists()).toBe(false);
    expect(w.get(tid('event-location-address')).text()).toBe(weber.address);
  });

  it('drops the place when its text is changed', async () => {
    photon();
    const { w, input, place } = await mountField();
    await type(input, 'Zahn');
    await w.findAll(tid('place-suggestion'))[0]!.trigger('click');
    await type(input, 'Zahnarzt am Markt');
    expect(place.value).toBeNull();
    expect(w.find(tid('event-location-address')).exists()).toBe(false);
  });

  it('stays a plain field when the search fails or the device is offline', async () => {
    const calls = photon([weber], 503);
    const { w, input } = await mountField();
    await type(input, 'Zahn');
    expect(calls).toHaveLength(1);
    expect(w.find(tid('place-suggestions')).exists()).toBe(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await type(input, 'Zahnarzt');
    expect(calls).toHaveLength(1);
    expect((input.element as HTMLInputElement).value).toBe('Zahnarzt');
  });

  it('works with the keyboard: arrows highlight, Enter picks, Escape closes without leaving', async () => {
    photon();
    const { w, input, place } = await mountField();
    await type(input, 'Zahn');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(w.findAll(tid('place-suggestion')).map((r) => r.attributes('aria-selected'))).toEqual(['true', 'false']);
    expect(input.attributes('aria-activedescendant')).toBe(w.findAll(tid('place-suggestion'))[0]!.attributes('id'));
    await input.trigger('keydown', { key: 'Enter' });
    expect(place.value).toEqual(weber);

    await type(input, 'Zahnklinik');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    input.element.dispatchEvent(escape);
    await flushPromises();
    document.removeEventListener('keydown', outside);
    expect(w.find(tid('place-suggestions')).exists()).toBe(false);
    expect(outside).not.toHaveBeenCalled();
  });

  it('Enter without a highlighted place keeps the text and moves on to the description', async () => {
    photon();
    const { w, input, text } = await mountField();
    await type(input, 'Zahn');
    await input.trigger('keydown', { key: 'Enter' });
    expect(w.find(tid('place-suggestions')).exists()).toBe(false);
    expect(text.value).toBe('Zahn');
    expect(document.activeElement).toBe(w.get('[data-field="description"]').element);
  });
});
