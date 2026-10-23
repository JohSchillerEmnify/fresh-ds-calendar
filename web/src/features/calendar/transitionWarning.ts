/**
 * Reminders in the open app and in the Android app (feature reminders). Both follow the reminder
 * plan (`reminderPlan.ts`): one reminder per timed event, and per timed task list when the person switched those on, and per
 * reminder lead of the item. Driven by the shared clock tick (`clock.nowTick`), so no timers of its own.
 * In the app, a dismissible snackbar "<title> starts in <lead>" (the lead as the reminder names it) shows once per event and lead from its time until the start
 * (several due leads show the nearest one). Events of hidden calendars never remind. It sees the items of the loaded range
 * only, i.e. while a calendar view showing today is cached.
 * Inside the Android app the next reminders (the next week, as far as loaded) are also scheduled ahead with the native
 * `Reminders` plugin, so they arrive as notifications while the app is closed, as chosen in Settings → Notifications
 * (`prefs.notify`), plus the optional morning overview of the day. In a browser with Web Push switched on, the plan of the next
 * 7 days (`pushPlan`) is sent to the server whenever it changed (the server sends each push at its time). Stored ids no longer wanted are cancelled, once on start
 * for everything the plugin still holds.
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { usePrefsStore } from '@/stores/prefs';
import { pushPlan, reminderPlan, reminderText, type PlannedReminder } from './reminderPlan';
import { t } from '@/i18n';
import { language } from '@/i18n/language';
import { addDays, toIsoDate } from '@/lib/dates';
import type { Segment } from '@/lib/items';
import { remindersPlugin, type ReminderKind } from '@/native/reminders';
import { localToIso } from './zone';
import { pushEndpoint, pushSupported, refreshPushState, sendPushPlan } from '@/pwa/push';

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
  /** occurrence -> { snackbar id, start (epoch ms), item title } of the reminders currently shown. */
  const shown = new Map<string, { id: number; startAt: number; itemTitle: string }>();
  /** The snackbar text at `minuteStart`: the minutes really left, so it stays right while it is open. */
  const liveText = (itemTitle: string, startAt: number, minuteStart: number): string => reminderText(itemTitle, Math.round((startAt - minuteStart) / 60_000));
  let day = clock.today;

  /** The next `PLAN_DAYS` days of segments, today first, without the calendars the person switched off. */
  const days = (): Segment[][] => Array.from({ length: PLAN_DAYS }, (_, i) => {
    const date = i === 0 ? clock.today : toIsoDate(addDays(clock.todayDate, i));
    return (items.byDate.get(date) ?? []).filter((s) => !cals.isHidden(s.item.calendarId));
  });
  /**
   * Whether loaded ranges cover all `PLAN_DAYS` days from today, so a plan built now is complete (`byDate` has no entry for
   * a day without appointments, so it cannot tell). If not, the window is fetched; the watchers run again once it is in.
   */
  const windowLoaded = (): boolean => {
    const ranges = Object.values(items.ranges);
    const dates = Array.from({ length: PLAN_DAYS }, (_, i) => toIsoDate(addDays(clock.todayDate, i)));
    if (dates.every((d) => ranges.some((r) => r.from <= d && d < r.to))) return true;
    items.prefetch(clock.today, toIsoDate(addDays(clock.todayDate, PLAN_DAYS)));
    return false;
  };
  const plan = (kinds: { events: boolean; tasklists: boolean }): PlannedReminder[] =>
    reminderPlan(days(), clock.nowTick, kinds, t('tasks.list.fallbackLabel'), clock.timeZone);

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
          } else {
            ui.update(w.id, liveText(w.itemTitle, w.startAt, minuteStart));
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
          // the minutes left, counted down on every tick while it is shown
          const id = ui.notify(liveText(p.itemTitle, p.startAt, minuteStart), { duration: 0, testid: 'transition-warning' });
          shown.set(occurrence, { id, startAt: p.startAt, itemTitle: p.itemTitle });
        }
      },
      { immediate: true },
    );

    // Browser with Web Push switched on: the server sends the next 7 days of reminders, so the plan goes to it whenever it changes
    if (pushSupported()) {
      void refreshPushState();
      let sentSig = '';
      watch(
        () => [items.byDate, items.ranges, cals.hidden, language.value, prefs.notify, pushEndpoint.value] as const,
        async () => {
          const endpoint = pushEndpoint.value;
          if (!endpoint) { sentSig = ''; return; }
          // a plan of a partly loaded week would wipe the server's pushes of the days not loaded
          if (!windowLoaded()) return;
          const entries = pushPlan(plan({ events: prefs.notify.events, tasklists: prefs.notify.tasklists }), clock.nowTick);
          const sig = `${endpoint}|${JSON.stringify(entries)}`;
          if (sig === sentSig) return;
          if (await sendPushPlan(endpoint, entries)) sentSig = sig;
        },
        { immediate: true },
      );
    }

    // Android app: keep the next reminders scheduled as notifications (shown only while the app is not in front)
    const plugin = remindersPlugin();
    if (!plugin) return;
    const sent = new Map<string, string>();
    let cleaned = false;
    watch(
      () => [clock.nowTick, items.byDate, items.ranges, cals.hidden, language.value, prefs.notify] as const,
      () => {
        if (typeof document !== 'undefined' && document.hidden) return; // the schedule stays as it was left
        // with planned days missing (not loaded yet, or evicted from the range cache) their reminders would look gone and be
        // cancelled: the schedule stays as it was until the window is loaded again (it is fetched)
        if (!windowLoaded()) return;
        const tomorrow = toIsoDate(addDays(clock.todayDate, 1));
        const minuteStart = clock.nowTick - (clock.nowTick % 60_000);
        const next = plan({ events: prefs.notify.events, tasklists: prefs.notify.tasklists }).filter((p) => p.at > minuteStart).slice(0, NATIVE_REMINDER_LIMIT);
        // named by the item with its times; the phone counts down to the start (a fixed "in 10 min" would go stale) and
        // keeps the notification until the end
        const want = new Map<string, { at: number; title: string; body: string; kind: ReminderKind; start?: number; end?: number }>(
          next.map((p) => [NATIVE_REMINDER_PREFIX + p.key, { at: p.at, title: p.itemTitle, body: p.body, kind: p.kind, start: p.startAt, end: p.endAt }]),
        );
        // the morning overview: today's if its time is still ahead, else tomorrow's (loaded on demand)
        if (prefs.notify.morning) {
          const [h, m] = prefs.notify.morningTime.split(':').map(Number);
          const dayOfOverview = h * 60 + m > clock.minutesNow ? clock.today : tomorrow;
          if (dayOfOverview === tomorrow) items.prefetch(tomorrow, toIsoDate(addDays(clock.todayDate, 2)));
          const visible = (items.byDate.get(dayOfOverview) ?? []).filter((s) => !cals.isHidden(s.item.calendarId) && !s.carriedFrom);
          // the instant of that wall-clock time in the calendar zone (right across a clock change)
          const at = Date.parse(localToIso(dayOfOverview, prefs.notify.morningTime, clock.timeZone));
          want.set(NATIVE_MORNING_ID, { at, kind: 'summary', ...morningOverview(visible) });
        }
        // once per start (the planned days are loaded here): whatever the plugin still holds that is not planned is stale
        if (!cleaned) {
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
          const sig = `${w.at}|${w.title}|${w.body}|${w.kind}|${w.start ?? ''}|${w.end ?? ''}`;
          if (sent.get(id) === sig) continue;
          sent.set(id, sig);
          void plugin.schedule({ id, ...w }).catch(() => undefined);
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
