import { defineStore } from 'pinia';
import { api } from '@/api/client';
import type { HolidayRegion, HolidayVariant } from '@calendar/shared/api';
import { useCalendarsStore } from './calendars';
import { useDeviceStore } from './device';

/** The holiday regions (feature holiday-regions): what can be added, and adding or removing one in the person's Google list (all need a connection). */
export const useHolidaysStore = defineStore('holidays', () => {
  const cals = useCalendarsStore();

  /** The countries Google has a holiday calendar for in `lang`, with the variants the person already has. */
  async function regions(lang: string): Promise<HolidayRegion[]> {
    return (await api.holidayRegions(lang)).regions;
  }

  /** Adds a region's holiday calendar; it joins the list at once. */
  async function add(code: string, variant: HolidayVariant, lang: string): Promise<void> {
    const cal = await api.addHolidayCalendar(code, variant, lang);
    cals.stored = [...cals.stored.filter((c) => c.id !== cal.id), cal];
    useDeviceStore().putCalendars(cals.stored);
  }

  /** Removes a holiday calendar; it and its events leave the list and the device once Google has done it. */
  async function remove(id: string): Promise<void> {
    await api.removeHolidayCalendar(id);
    cals.stored = cals.stored.filter((c) => c.id !== id);
    useDeviceStore().dropCalendar(id);
  }

  return { regions, add, remove };
});
