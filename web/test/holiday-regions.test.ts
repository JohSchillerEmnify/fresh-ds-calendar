// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import HolidayRegionSheet from '@/components/settings/HolidayRegionSheet.vue';
import { language } from '@/i18n/language';
import type { HolidayRegion } from '@calendar/shared/api';
import { googleLang, matchRegions, regionName } from '@/lib/holidayRegions';
import { useHolidaysStore } from '@/stores/holidays';

const regions: HolidayRegion[] = [
  { code: 'AT', variants: ['official'], added: [] },
  { code: 'DE', variants: ['official', 'all'], added: [] },
  { code: 'FR', variants: ['official', 'all'], added: ['official', 'all'] },
];
let w: VueWrapper | null = null;
beforeEach(() => { setActivePinia(createPinia()); language.value = 'en'; });
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('holiday regions', () => {
  it('searches region names in the app language', () => {
    language.value = 'de';
    expect(regionName('AT', 'de')).toBe('Österreich');
    expect(matchRegions(regions, 'Öster', 'de').map((r) => r.code)).toEqual(['AT']);
    expect(matchRegions(regions, 'oster', 'de').map((r) => r.code)).toEqual(['AT']);
    expect(matchRegions(regions, 'germ', 'en').map((r) => r.code)).toEqual(['DE']);
    expect(googleLang('de-x-mainfr')).toBe('de');
    expect(googleLang('en')).toBe('en');
  });

  it('leaves out a region that has every variant already, and sorts by name', () => {
    expect(matchRegions(regions, '', 'en').map((r) => r.name)).toEqual(['Austria', 'Germany']);
  });

  it('says adding needs a connection', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const ask = vi.spyOn(useHolidaysStore(), 'regions');
    w = mount(HolidayRegionSheet, { attachTo: document.body });
    await flushPromises();
    expect(document.body.querySelector('[data-testid="holiday-offline"]')?.textContent).toContain('needs a connection');
    expect(ask).not.toHaveBeenCalled();
  });
});
