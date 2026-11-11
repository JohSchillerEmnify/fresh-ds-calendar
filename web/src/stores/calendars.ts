import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { api } from '@/api/client';
import { t } from '@/i18n';
import type { Calendar } from '@/api/types';
import type { CalendarPlan } from '@calendar/shared/prefs';
import { saveCalendarColor } from '@/lib/calendarColor';
import { logUndone } from '@/lib/decisionLog';
import { awayActive, hasPlan, wallNow } from '@/lib/calendarPlan';
import { useClockStore } from './clock';
import { useDeviceStore } from './device';

/** Where the plans live (the prefs store, wired by the calendar feature), so this store does not import prefs (no import cycle). */
export interface PlanSource { plans(): Record<string, CalendarPlan>; save(plans: Record<string, CalendarPlan>): Promise<void> }
// reactive, so a `hidden` worked out before the feature wired the source is worked out again
const source = shallowRef<PlanSource>({ plans: () => ({}), save: async () => {} });
export function setPlanSource(s: PlanSource): void {
  source.value = s;
}

// the server names the virtual Birthdays calendar in English; the device copy keeps that, the screen shows the app language
const named = (c: Calendar): Calendar => (c.virtual && c.id === 'birthdays' ? { ...c, name: t('calendar.birthdaysCalendar') } : c);

/** Every calendar of the person with their hidden choice and plan (feature calendar-off-plan). Toggling is instant; the server is told in the background. */
export const useCalendarsStore = defineStore('calendars', () => {
  const raw = ref<Calendar[]>([]);
  const list = computed(() => raw.value.map(named));
  let saving = 0;
  const clock = useClockStore();
  const nowWall = computed(() => wallNow(clock.today, clock.minutesNow));
  const planOf = (id: string): CalendarPlan | undefined => source.value.plans()[id];

  // the server switches `hidden` at a plan's edges, so this is the one flag every view reads
  const hidden = computed(() => new Set(raw.value.filter((c) => c.hidden).map((c) => c.id)));
  const isHidden = (calendarId: string) => hidden.value.has(calendarId);

  /** Takes the list the device holds; a poll must not undo a toggle that is still being saved. */
  function fromDevice(saved: Calendar[]): void {
    if (saving === 0) raw.value = saved;
  }

  /** Reads the list from the device store; the server only before the device has had its first sync. */
  async function load(): Promise<void> {
    const device = useDeviceStore();
    if (device.ready) return fromDevice(device.data!.calendars);
    fromDevice((await api.calendars()).calendars);
  }

  /** Saves the plans with one calendar's plan replaced (none: removed). */
  function savePlan(id: string, plan: CalendarPlan | undefined): Promise<void> {
    const plans = { ...source.value.plans() };
    if (hasPlan(plan)) plans[id] = plan;
    else delete plans[id];
    return source.value.save(plans);
  }

  /** A tap: switches what the person sees now; it holds until the plan's next edge, and ends "Off for a while". */
  async function toggle(id: string): Promise<void> {
    const cur = raw.value.find((c) => c.id === id);
    if (!cur) return;
    const plan = planOf(id);
    if (hasPlan(plan) && awayActive(plan, nowWall.value)) {
      const kept = { ...plan };
      delete kept.until;
      delete kept.since;
      // the tap still counts when the plan cannot be saved; the plan's own rollback keeps the old one
      await savePlan(id, kept).catch(() => undefined);
    }
    await setHidden(id, !cur.hidden);
  }

  /** Sets the plan from the sheet (undefined = "Always on", which also switches the calendar on). */
  async function setPlan(id: string, plan: CalendarPlan | undefined): Promise<void> {
    const fresh = plan && { ...(plan.windows?.length ? { windows: plan.windows } : {}), ...(plan.until ? { until: plan.until, since: plan.since ?? nowWall.value } : {}) };
    await savePlan(id, fresh);
    if (!hasPlan(fresh) && raw.value.find((c) => c.id === id)?.hidden) await setHidden(id, false);
    // the server applies a new plan at once; read its flags now instead of waiting for the next sync
    else if (hasPlan(fresh)) await api.calendars().then((r) => { fromDevice(r.calendars); useDeviceStore().putCalendars(r.calendars); }).catch((e) => logUndone('calendar plan refresh', e));
  }

  async function setHidden(id: string, next: boolean): Promise<void> {
    raw.value = raw.value.map((c) => (c.id === id ? { ...c, hidden: next } : c));
    saving++;
    try {
      await api.setCalendarHidden(id, next);
      useDeviceStore().putCalendars(raw.value);
    } catch (e) {
      logUndone('calendar hidden', e);
      raw.value = raw.value.map((c) => (c.id === id ? { ...c, hidden: !next } : c));
    } finally {
      saving--;
    }
  }

  /** Replaces a calendar's popup reminder defaults (Google's `defaultReminders`); shown at once, rolled back on failure. */
  async function setDefaultReminders(id: string, minutes: number[]): Promise<void> {
    const before = raw.value;
    raw.value = before.map((c) => (c.id === id ? { ...c, defaultReminders: minutes } : c));
    saving++;
    try {
      const saved = await api.setCalendarDefaultReminders(id, minutes);
      raw.value = raw.value.map((c) => (c.id === id ? { ...c, defaultReminders: saved.defaultReminders ?? minutes } : c));
      useDeviceStore().putCalendars(raw.value);
    } catch (e) {
      logUndone('calendar default reminders', e);
      // an empty list is deliberate when the calendar is missing from the snapshot
      raw.value = raw.value.map((c) => (c.id === id ? { ...c, defaultReminders: before.find((x) => x.id === id)?.defaultReminders ?? [] } : c));
      throw e;
    } finally {
      saving--;
    }
  }

  /** Sets the person's colour of a calendar (feature calendar-colours); a poll must not undo it while it is being saved. */
  async function setColor(id: string, color: string, colorId?: string): Promise<void> {
    saving++;
    try {
      await saveCalendarColor(raw, id, color, colorId, useDeviceStore().putCalendars);
    } finally {
      saving--;
    }
  }

  return { list, stored: raw, hidden, isHidden, planOf, nowWall, load, fromDevice, toggle, setPlan, setDefaultReminders, setColor };
});
