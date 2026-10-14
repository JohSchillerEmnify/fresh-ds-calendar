/**
 * Transition warnings: a dismissible snackbar "<title> starts in <N> min" once per event when now is within the
 * configured minutes (Settings, 0 = off). Driven by the shared clock tick (`clock.nowTick`), so no timers of its own.
 * Events of hidden calendars are skipped. It sees the events of the loaded range only, i.e. while a calendar view showing today is cached.
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { dueWarnings } from './timeline';
import { t } from '@/i18n';

export const warningText = (title: string, inMin: number) => t('calendar.warning.startsIn', { title, minutes: inMin });

let scope: EffectScope | null = null;

/** Starts the watcher on the active Pinia (a previous one is stopped first). Returns a stop function. */
export function startTransitionWarnings(): () => void {
  stopTransitionWarnings();
  const clock = useClockStore();
  const items = useItemsStore();
  const cals = useCalendarsStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const warned = new Set<string>();
  /** key -> { snackbar id, event start minute } of warnings currently shown. */
  const shown = new Map<string, { id: number; startMin: number; title: string }>();
  let day = clock.today;

  scope = effectScope(true);
  scope.run(() => {
    watch(
      () => [clock.nowTick, settings.settings.transitionWarningMinutes, items.byDate, cals.hidden] as const,
      () => {
        if (clock.today !== day) { day = clock.today; warned.clear(); }
        const now = clock.minutesNow;
        const n = settings.settings.transitionWarningMinutes;
        // events of calendars the person switched off never warn (same filter as the views)
        const segs = (items.byDate.get(clock.today) ?? []).filter((s) => !cals.isHidden(s.item.calendarId));
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
  });
  return stopTransitionWarnings;
}

export function stopTransitionWarnings(): void {
  scope?.stop();
  scope = null;
}
