/**
 * Transition warnings: a dismissible snackbar "<title> starts in <N> min" once per event when now is within the
 * configured minutes (Settings, 0 = off). Driven by the shared clock tick (`clock.nowTick`), so no timers of its own.
 * It sees the events of the loaded range only, i.e. while a calendar view showing today is cached.
 * Inside the Android app the next warnings (today and tomorrow, as far as loaded) are also scheduled ahead with the native
 * `Reminders` plugin, so they arrive as notifications while the app is closed (ARCHITECTURE "Android app and widget").
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
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
export function upcomingWarnings(days: Segment[][], nowMin: number, minutes: number, limit = NATIVE_WARNING_LIMIT): UpcomingWarning[] {
  if (minutes <= 0) return [];
  const out: UpcomingWarning[] = [];
  days.forEach((segs, i) => {
    for (const s of segs) {
      if (s.item.kind !== 'event' || s.allDay || !s.first || s.startTime === null) continue;
      const inMin = i * 1440 + s.startMin - minutes - nowMin;
      if (inMin > 0) out.push({ key: `${s.item.id}@${s.date}T${s.startTime}`, title: s.item.title, start: s.startTime, inMin });
    }
  });
  return out.sort((a, b) => a.inMin - b.inMin).slice(0, limit);
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
    const sent = new Map<string, string>();
    watch(
      () => [clock.nowTick, settings.settings.transitionWarningMinutes, items.byDate, language.value] as const,
      () => {
        if (typeof document !== 'undefined' && document.hidden) return; // the schedule stays as it was left
        const n = settings.settings.transitionWarningMinutes;
        const tomorrow = toIsoDate(addDays(clock.todayDate, 1));
        const next = upcomingWarnings([items.byDate.get(clock.today) ?? [], items.byDate.get(tomorrow) ?? []], clock.minutesNow, n);
        const minuteStart = clock.nowTick - (clock.nowTick % 60_000);
        const want = new Map(next.map((w) => [NATIVE_WARNING_PREFIX + w.key, w]));
        for (const id of [...sent.keys()]) {
          if (want.has(id)) continue;
          sent.delete(id);
          void plugin.cancel({ id }).catch(() => undefined);
        }
        for (const [id, w] of want) {
          const at = minuteStart + w.inMin * 60_000;
          const title = warningText(w.title, n);
          const sig = `${at}|${title}`;
          if (sent.get(id) === sig) continue;
          sent.set(id, sig);
          void plugin.schedule({ id, at, title, body: w.start }).catch(() => undefined);
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
