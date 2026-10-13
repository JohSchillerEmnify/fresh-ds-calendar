/**
 * Transition warnings: a dismissible snackbar "<title> starts in <N> min" once per event when now is within the
 * configured minutes (Settings, 0 = off). Driven by the shared clock tick (`clock.nowTick`), so no timers of its own.
 * It sees the events of the loaded range only, i.e. while a calendar view showing today is cached.
 * Inside the Android app the next warnings (today and tomorrow, as far as loaded) are also scheduled ahead with the native
 * `Reminders` plugin, so they arrive as notifications while the app is closed: before events and before task lists with
 * a time, each as chosen in Settings → Notifications (`prefs.notify`), plus the optional morning overview of the day
 * (ARCHITECTURE "Notifications").
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { usePrefsStore } from '@/stores/prefs';
import { dueWarnings } from './timeline';
import { t } from '@/i18n';
import { language } from '@/i18n/language';
import { addDays, toIsoDate } from '@/lib/dates';
import type { Segment } from '@/lib/items';
import { remindersPlugin } from '@/native/reminders';

export const warningText = (title: string, inMin: number) => t('calendar.warning.startsIn', { title, minutes: inMin });

/** A warning to schedule ahead: `inMin` minutes from now (the event starts `minutes` after that). */
export interface UpcomingWarning { key: string; title: string; start: string; inMin: number }

/** Prefix of the native reminder ids of transition warnings. */
export const NATIVE_WARNING_PREFIX = 'transition:';
/** At most this many warnings are scheduled ahead. */
export const NATIVE_WARNING_LIMIT = 8;

/**
 * The next transition warnings after now, soonest first: timed events (their first day) of today and the following
 * days given, whose warning time (start minus `minutes`) is still ahead.
 *
 * @param days Segments per day, today first, consecutive days.
 * @param nowMin Minute of today.
 * @param minutes Warning lead; 0 means none.
 * @param limit At most this many.
 */
export function upcomingWarnings(
  days: Segment[][], nowMin: number, minutes: number, limit = NATIVE_WARNING_LIMIT, kinds: { events: boolean; tasklists: boolean } = { events: true, tasklists: false },
): UpcomingWarning[] {
  if (minutes <= 0) return [];
  const out: UpcomingWarning[] = [];
  days.forEach((segs, i) => {
    for (const s of segs) {
      if (s.allDay || !s.first || s.startTime === null || s.carriedFrom) continue;
      if (s.item.kind === 'event' ? !kinds.events : !kinds.tasklists) continue;
      const inMin = i * 1440 + s.startMin - minutes - nowMin;
      const title = s.item.title.trim() || t('tasklist.untitled');
      if (inMin > 0) out.push({ key: `${s.item.id}@${s.date}T${s.startTime}`, title, start: s.startTime, inMin });
    }
  });
  return out.sort((a, b) => a.inMin - b.inMin).slice(0, limit);
}

/** Native reminder id of the morning overview (one pending at a time). */
export const NATIVE_MORNING_ID = 'morning';

/**
 * The morning overview of a day: "Your day" and "3 appointments · 2 lists · first: Dentist 10:00".
 *
 * @param segs The day's segments.
 */
export function morningOverview(segs: Segment[]): { title: string; body: string } {
  const events = segs.filter((s) => s.item.kind === 'event');
  const lists = segs.filter((s) => s.item.kind === 'tasklist');
  const firstTimed = events.filter((s) => !s.allDay && s.startTime !== null).sort((a, b) => a.startMin - b.startMin)[0];
  const parts = [
    t('settings.notifications.overview.appointments', { count: events.length }, events.length),
    t('settings.notifications.overview.lists', { count: lists.length }, lists.length),
  ];
  if (firstTimed) parts.push(t('settings.notifications.overview.first', { title: firstTimed.item.title, time: firstTimed.startTime ?? '' }));
  return { title: t('settings.notifications.overview.title'), body: parts.join(' · ') };
}

let scope: EffectScope | null = null;

/** Starts the watcher on the active Pinia (a previous one is stopped first). Returns a stop function. */
export function startTransitionWarnings(): () => void {
  stopTransitionWarnings();
  const clock = useClockStore();
  const items = useItemsStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const warned = new Set<string>();
  /** key -> { snackbar id, event start minute } of warnings currently shown. */
  const shown = new Map<string, { id: number; startMin: number; title: string }>();
  let day = clock.today;

  scope = effectScope(true);
  scope.run(() => {
    watch(
      () => [clock.nowTick, settings.settings.transitionWarningMinutes, items.byDate] as const,
      () => {
        if (clock.today !== day) { day = clock.today; warned.clear(); }
        const now = clock.minutesNow;
        const n = settings.settings.transitionWarningMinutes;
        const segs = items.byDate.get(clock.today) ?? [];
        // refresh / auto-hide what is on screen
        for (const [key, w] of shown) {
          if (n <= 0 || now >= w.startMin || !ui.snackbars.some((s) => s.id === w.id)) {
            ui.dismiss(w.id);
            shown.delete(key);
          } else {
            const text = warningText(w.title, w.startMin - now);
            ui.snackbars = ui.snackbars.map((s) => (s.id === w.id && s.text !== text ? { ...s, text } : s));
          }
        }
        for (const d of dueWarnings(segs, now, n)) {
          if (warned.has(d.key)) continue;
          warned.add(d.key);
          const id = ui.notify(warningText(d.title, d.inMin), { duration: 0, testid: 'transition-warning' });
          shown.set(d.key, { id, startMin: d.startMin, title: d.title });
        }
      },
      { immediate: true },
    );

    // Android app: keep the next warnings scheduled as notifications (shown only while the app is not in front)
    const plugin = remindersPlugin();
    if (!plugin) return;
    const prefs = usePrefsStore();
    const sent = new Map<string, string>();
    watch(
      () => [clock.nowTick, settings.settings.transitionWarningMinutes, items.byDate, language.value, prefs.notify] as const,
      () => {
        if (typeof document !== 'undefined' && document.hidden) return; // the schedule stays as it was left
        const n = settings.settings.transitionWarningMinutes;
        const tomorrow = toIsoDate(addDays(clock.todayDate, 1));
        const kinds = { events: prefs.notify.events, tasklists: prefs.notify.tasklists };
        const next = upcomingWarnings([items.byDate.get(clock.today) ?? [], items.byDate.get(tomorrow) ?? []], clock.minutesNow, n, NATIVE_WARNING_LIMIT, kinds);
        const minuteStart = clock.nowTick - (clock.nowTick % 60_000);
        const want = new Map<string, { at: number; title: string; body: string }>(next.map((w) => [NATIVE_WARNING_PREFIX + w.key, {
          at: minuteStart + w.inMin * 60_000, title: warningText(w.title, n), body: w.start,
        }]));
        // the morning overview: today's if its time is still ahead, else tomorrow's (loaded on demand)
        if (prefs.notify.morning) {
          const [h, m] = prefs.notify.morningTime.split(':').map(Number);
          const at = h * 60 + m;
          const day = at > clock.minutesNow ? clock.today : tomorrow;
          if (day === tomorrow) items.prefetch(tomorrow, toIsoDate(addDays(clock.todayDate, 2)));
          const o = morningOverview((items.byDate.get(day) ?? []).filter((s) => !s.carriedFrom));
          want.set(NATIVE_MORNING_ID, { at: minuteStart + ((day === tomorrow ? 1440 : 0) + at - clock.minutesNow) * 60_000, ...o });
        }
        for (const id of [...sent.keys()]) {
          if (want.has(id)) continue;
          sent.delete(id);
          void plugin.cancel({ id }).catch(() => undefined);
        }
        for (const [id, w] of want) {
          const sig = `${w.at}|${w.title}|${w.body}`;
          if (sent.get(id) === sig) continue;
          sent.set(id, sig);
          void plugin.schedule({ id, at: w.at, title: w.title, body: w.body }).catch(() => undefined);
        }
      },
      { immediate: true },
    );
  });
  return stopTransitionWarnings;
}

export function stopTransitionWarnings(): void {
  scope?.stop();
  scope = null;
}
