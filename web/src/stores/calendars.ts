import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';
import type { CalendarPlan } from '@calendar/shared/prefs';
import { saveCalendarColor } from '@/lib/calendarColor';
import { awayActive, hasPlan, planEffectiveHidden, wallNow } from '@/lib/calendarPlan';
import { useClockStore } from './clock';
import { useDeviceStore } from './device';

/** Where the plans live (the prefs store, wired by the calendar feature), so this store does not import prefs (no import cycle). */
export interface PlanSource { plans(): Record<string, CalendarPlan>; save(plans: Record<string, CalendarPlan>): Promise<void> }
// reactive, so a `hidden` worked out before the feature wired the source is worked out again
const source = shallowRef<PlanSource>({ plans: () => ({}), save: async () => {} });
export function setPlanSource(s: PlanSource): void {
  source.value = s;
}

/** Every calendar of the person with their hidden choice and plan (feature calendar-off-plan). Toggling is instant; the server is told in the background. */
export const useCalendarsStore = defineStore('calendars', () => {
  const list = ref<Calendar[]>([]);
  let saving = 0;
  const clock = useClockStore();
  // the clock's minute tick lands on every plan edge (edges are whole minutes), so no timer of its own is needed
  const nowWall = computed(() => wallNow(clock.today, clock.minutesNow));
  const planOf = (id: string): CalendarPlan | undefined => source.value.plans()[id];

  const hidden = computed(() => new Set(list.value.filter((c) => planEffectiveHidden(!!c.hidden, planOf(c.id), nowWall.value)).map((c) => c.id)));
  const isHidden = (calendarId: string) => hidden.value.has(calendarId);

  /** Takes the list the device holds; a poll must not undo a toggle that is still being saved. */
  function fromDevice(saved: Calendar[]): void {
    if (saving === 0) list.value = saved;
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

  /** A tap: switches what the person sees now; with a plan the tap holds until the plan's next switch and ends "Off for a while". */
  async function toggle(id: string): Promise<void> {
    const cur = list.value.find((c) => c.id === id);
    if (!cur) return;
    const next = !isHidden(id);
    const plan = planOf(id);
    if (hasPlan(plan)) {
      const kept = { ...plan };
      delete kept.until;
      delete kept.since;
      // the tap still counts when the plan cannot be saved; the plan's own rollback keeps the old one
      await savePlan(id, { ...(awayActive(plan, nowWall.value) ? kept : plan), switchedAt: nowWall.value }).catch(() => undefined);
    }
    if (!!cur.hidden === next) return;
    await setHidden(id, next);
  }

  /** Sets the plan from the sheet (undefined = "Always on", which also switches the calendar on). */
  async function setPlan(id: string, plan: CalendarPlan | undefined): Promise<void> {
    const fresh = plan && { ...(plan.windows?.length ? { windows: plan.windows } : {}), ...(plan.until ? { until: plan.until, since: plan.since ?? nowWall.value } : {}) };
    await savePlan(id, fresh);
    if (!hasPlan(fresh) && list.value.find((c) => c.id === id)?.hidden) await setHidden(id, false);
  }

  async function setHidden(id: string, next: boolean): Promise<void> {
    list.value = list.value.map((c) => (c.id === id ? { ...c, hidden: next } : c));
    saving++;
    try {
      await api.setCalendarHidden(id, next);
      useDeviceStore().putCalendars(list.value);
    } catch {
      list.value = list.value.map((c) => (c.id === id ? { ...c, hidden: !next } : c));
    } finally {
      saving--;
    }
  }

  /** Replaces a calendar's popup reminder defaults (Google's `defaultReminders`); shown at once, rolled back on failure. */
  async function setDefaultReminders(id: string, minutes: number[]): Promise<void> {
    const before = list.value;
    list.value = before.map((c) => (c.id === id ? { ...c, defaultReminders: minutes } : c));
    saving++;
    try {
      const saved = await api.setCalendarDefaultReminders(id, minutes);
      list.value = list.value.map((c) => (c.id === id ? { ...c, defaultReminders: saved.defaultReminders ?? minutes } : c));
      useDeviceStore().putCalendars(list.value);
    } catch (e) {
      // an empty list is deliberate when the calendar is missing from the snapshot
      list.value = list.value.map((c) => (c.id === id ? { ...c, defaultReminders: before.find((x) => x.id === id)?.defaultReminders ?? [] } : c));
      throw e;
    } finally {
      saving--;
    }
  }

  /** Sets the person's colour of a calendar (feature calendar-colours); a poll must not undo it while it is being saved. */
  async function setColor(id: string, color: string, colorId?: string): Promise<void> {
    saving++;
    try {
      await saveCalendarColor(list, id, color, colorId, useDeviceStore().putCalendars);
    } finally {
      saving--;
    }
  }

  return { list, hidden, isHidden, planOf, nowWall, load, fromDevice, toggle, setPlan, setDefaultReminders, setColor };
});
