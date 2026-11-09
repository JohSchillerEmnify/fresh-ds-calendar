/** The small static map of a picked place (feature event-location). */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EventMap from '@/features/calendar/EventMap.vue';

const tid = (id: string) => `[data-testid="${id}"]`;
const weber = { name: 'Zahnarztpraxis Dr. Weber', lat: 52.4867, lon: 13.3536 };
const tileUrl = 'https://tiles.test/{z}/{x}/{y}.png';

describe('event map', () => {
  it('shows the map pictures around the place with the pin and the OpenStreetMap credit', () => {
    const w = mount(EventMap, { props: { place: weber, tileUrl } });
    const map = w.get(tid('event-map'));
    expect(map.attributes('data-lat')).toBe('52.4867');
    expect(map.attributes('data-lon')).toBe('13.3536');
    expect(map.attributes('aria-label')).toBe('Map of Zahnarztpraxis Dr. Weber');
    const imgs = w.findAll('img');
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.length).toBeLessThanOrEqual(6);
    for (const i of imgs) {
      expect(i.attributes('src')).toMatch(/^https:\/\/tiles\.test\/16\/3519[89]\/2150[23]\.png$/);
      expect(i.attributes('crossorigin')).toBe('anonymous');
      expect(i.attributes('data-loaded')).toBe('false');
    }
    expect(w.find(tid('event-map-pin')).exists()).toBe(true);
    expect(w.get(tid('event-map-credit')).text()).toBe('© OpenStreetMap');
    expect(w.find(tid('event-map-placeholder')).exists()).toBe(false);
  });

  it('marks each picture once it has loaded', async () => {
    const w = mount(EventMap, { props: { place: weber, tileUrl } });
    for (const i of w.findAll('img')) await i.trigger('load');
    expect(w.findAll('img').map((i) => i.attributes('data-loaded'))).toEqual(w.findAll('img').map(() => 'true'));
  });

  it('shows a placeholder with the pin and the place when a picture cannot be had', async () => {
    const w = mount(EventMap, { props: { place: weber, tileUrl } });
    await w.findAll('img')[0]!.trigger('error');
    expect(w.find(tid('event-map')).exists()).toBe(false);
    const ph = w.get(tid('event-map-placeholder'));
    expect(ph.text()).toContain('Zahnarztpraxis Dr. Weber');
    expect(ph.text()).toContain('The map shows when you are online');
    expect(ph.find(tid('event-map-pin')).exists()).toBe(true);
    expect(w.findAll('img')).toHaveLength(0);
  });

  it('starts again for another place', async () => {
    const w = mount(EventMap, { props: { place: weber, tileUrl } });
    await w.findAll('img')[0]!.trigger('error');
    await w.setProps({ place: { name: 'Zahnklinik Mitte', lat: 52.52, lon: 13.388 } });
    expect(w.get(tid('event-map')).attributes('data-lat')).toBe('52.5200');
  });

  it('is a placeholder when no map address is known', () => {
    const w = mount(EventMap, { props: { place: weber, tileUrl: '' } });
    expect(w.find(tid('event-map-placeholder')).exists()).toBe(true);
  });

  it('offers the place in Google Maps and on OpenStreetMap under the map, also as placeholder', async () => {
    const w = mount(EventMap, { props: { place: weber, tileUrl } });
    const group = w.get(tid('event-map-buttons'));
    const g = group.get(tid('event-map-google'));
    const o = group.get(tid('event-map-osm'));
    expect(g.element.tagName).toBe('A');
    expect(g.text()).toBe('Google Maps');
    expect(g.attributes('href')).toBe('https://www.google.com/maps/search/?api=1&query=52.4867,13.3536');
    expect(o.text()).toBe('OpenStreetMap');
    expect(o.attributes('href')).toBe('https://www.openstreetmap.org/?mlat=52.4867&mlon=13.3536#map=16/52.4867/13.3536');
    for (const a of [g, o]) {
      expect(a.attributes('target')).toBe('_blank');
      expect(a.attributes('rel')).toBe('noopener noreferrer');
    }
    await w.findAll('img')[0]!.trigger('error');
    expect(w.find(tid('event-map-buttons')).exists()).toBe(true);
  });
});
