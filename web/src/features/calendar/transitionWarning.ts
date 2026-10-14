/**
 * Reminders in the open app and in the Android app (ARCHITECTURE "Reminders, several per event"). Both follow the reminder
 * plan (`reminderPlan.ts`): one reminder per timed event, and per timed task list when the person switched those on, and per
 * reminder lead of the item. Driven by the shared clock tick (`clock.nowTick`), so no timers of its own.
 * In the app, a dismissible snackbar "<title> starts in <lead>" (the lead as the reminder names it) shows once per event and lead from its time until the start
 * (several due leads show the nearest one). Events of hidden calendars never remind. It sees the items of the loaded range
 * only, i.e. while a calendar view showing today is cached.
 * Inside the Android app the next reminders (the next week, as far as loaded) are also scheduled ahead with the native
 * `Reminders` plugin, so they arrive as notifications while the app is closed, as chosen in Settings → Notifications
 * (`prefs.notify`), plus the optional morning overview of the day. Stored ids no longer wanted are cancelled, once on start
 * for everything the plugin still holds.
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { usePrefsStore } from '@/stores/prefs';
import { reminderPlan, reminderText, type PlannedReminder } from './reminderPlan';
import { t } from '@/i18n';
import { language } from '@/i18n/language';
import { addDays, toIsoDate } from '@/lib/dates';
import type { Segment } from '@/lib/items';
import { remindersPlugin } from '@/native/reminders';

/** The wording of a snackbar for an event starting in `minutes` (kept as the one name tests and callers know). */
export const warningText = reminderText;

/** Prefix of the native reminder ids of event and task list reminders. */
export const NATIVE_REMINDER_PREFIX = 'reminder:';
/** Prefix of the ids the single transition warning scheduled before reminder lists existed; cancelled on start. */
export const NATIVE_LEGACY_PREFIX = 'transition:';
/** At most this many reminders are scheduled ahead, nearest first. */
export const NATIVE_REMINDER_LIMIT = 24;
/** The plan covers this many days from today (a lead can be a day). */
export const PLAN_DAYS = 8;

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

/** Starts the watchers on the active Pinia (previous ones are stopped first). Returns a stop function. */
export function startTransitionWarnings(): () => void {
  stopTransitionWarnings();
  const clock = useClockStore();
  const items = useItemsStore();
  const cals = useCalendarsStore();
  const ui = useUiStore();
  const prefs = usePrefsStore();
  const warned = new Set<string>();
  /** occurrence -> { snackbar id, start (epoch ms) } of the reminders currently shown. */
  const shown = new Map<string, { id: number; startAt: number }>();
  let day = clock.today;

  /** The next `PLAN_DAYS` days of segments, today first, without the calendars the person switched off. */
  const days = (): Segment[][] => Array.from({ length: PLAN_DAYS }, (_, i) => {
    const date = i === 0 ? clock.today : toIsoDate(addDays(clock.todayDate, i));
    return (items.byDate.get(date) ?? []).filter((s) => !cals.isHidden(s.item.calendarId));
  });
  const plan = (kinds: { events: boolean; tasklists: boolean }): PlannedReminder[] =>
    reminderPlan(days(), clock.nowTick, clock.minutesNow, kinds, t('tasklist.untitled'));

  scope = effectScope(true);
  scope.run(() => {
    watch(
      () => [clock.nowTick, items.byDate, cals.hidden, prefs.notify.tasklists, language.value] as const,
      () => {
        if (clock.today !== day) { day = clock.today; warned.clear(); }
        const minuteStart = clock.nowTick - (clock.nowTick % 60_000);
        // in the app events always remind; task lists only with the Reminders switch
        const all = plan({ events: true, tasklists: prefs.notify.tasklists });
        const occurrences = new Set(all.map((p) => p.occurrence));
        // auto-hide what is on screen once the event has started, was dismissed, or lost its reminders
        for (const [key, w] of shown) {
          if (minuteStart >= w.startAt || !occurrences.has(key) || !ui.snackbars.some((x) => x.id === w.id)) {
            ui.dismiss(w.id);
            shown.delete(key);
          }
        }
        // of the leads due for one event only the nearest one speaks; the earlier ones count as said
        const nearest = new Map<string, PlannedReminder>();
        for (const p of all) {
          if (p.at > minuteStart) continue;
          const cur = nearest.get(p.occurrence);
          if (!cur || p.lead < cur.lead) nearest.set(p.occurrence, p);
        }
        for (const [occurrence, p] of nearest) {
          const fresh = !warned.has(p.key);
          for (const q of all) if (q.occurrence === occurrence && q.at <= minuteStart) warned.add(q.key);
          if (!fresh) continue;
          const old = shown.get(occurrence);
          if (old) ui.dismiss(old.id);
          // the text names the reminder's own lead ("starts in 30 min"), not the minutes left
          const id = ui.notify(p.title, { duration: 0, testid: 'transition-warning' });
          shown.set(occurrence, { id, startAt: p.startAt });
        }
      },
      { immediate: true },
    );

    // Android app: keep the next reminders scheduled as notifications (shown only while the app is not in front)
    const plugin = remindersPlugin();
    if (!plugin) return;
    const sent = new Map<string, string>();
    let cleaned = false;
    watch(
      () => [clock.nowTick, items.byDate, cals.hidden, language.value, prefs.notify] as const,
      () => {
        if (typeof document !== 'undefined' && document.hidden) return; // the schedule stays as it was left
        const tomorrow = toIsoDate(addDays(clock.todayDate, 1));
        const minuteStart = clock.nowTick - (clock.nowTick % 60_000);
        const next = plan({ events: prefs.notify.events, tasklists: prefs.notify.tasklists }).filter((p) => p.at > minuteStart).slice(0, NATIVE_REMINDER_LIMIT);
        const want = new Map<string, { at: number; title: string; body: string }>(next.map((p) => [NATIVE_REMINDER_PREFIX + p.key, { at: p.at, title: p.title, body: p.body }]));
        // the morning overview: today's if its time is still ahead, else tomorrow's (loaded on demand)
        if (prefs.notify.morning) {
          const [h, m] = prefs.notify.morningTime.split(':').map(Number);
          const at = h * 60 + m;
          const dayOfOverview = at > clock.minutesNow ? clock.today : tomorrow;
          if (dayOfOverview === tomorrow) items.prefetch(tomorrow, toIsoDate(addDays(clock.todayDate, 2)));
          const visible = (items.byDate.get(dayOfOverview) ?? []).filter((s) => !cals.isHidden(s.item.calendarId) && !s.carriedFrom);
          want.set(NATIVE_MORNING_ID, { at: minuteStart + ((dayOfOverview === tomorrow ? 1440 : 0) + at - clock.minutesNow) * 60_000, ...morningOverview(visible) });
        }
        // once per start, once today's items are loaded: whatever the plugin still holds that is not planned is stale
        if (!cleaned && items.byDate.has(clock.today)) {
          cleaned = true;
          // an older APK has no `list`: the call then fails and nothing is cleaned
          void Promise.resolve().then(() => plugin.list()).then(({ ids }) => {
            for (const id of ids) {
              if ((id.startsWith(NATIVE_REMINDER_PREFIX) || id.startsWith(NATIVE_LEGACY_PREFIX)) && !want.has(id)) void plugin.cancel({ id }).catch(() => undefined);
            }
          }, () => undefined);
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
