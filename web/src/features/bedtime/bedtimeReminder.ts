/**
 * Bedtime reminder: "Bedtime in N minutes" once per night while the app is open. Driven by the shared clock tick
 * (`clock.nowTick`, which pauses while the app is hidden), so it has no timer of its own. The reminder is handed to a
 * list of sinks; the snackbar is the first one and a later push notification can add another without touching the
 * schedule (ARCHITECTURE "Bedtime mode").
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { addDays, toIsoDate } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';
import { absMinutes, type BedtimeWindow } from './bedtime';
import { useBedtimeWindows } from './useBedtime';
import { t } from '@/i18n';

/** A reminder that is due. */
export interface BedtimeReminder {
  /** The night it is about (its wake-up date). */
  night: string;
  /** Minutes until bedtime. */
  inMin: number;
}

/** Where a due reminder goes (the snackbar; later a push notification). */
export type ReminderSink = (r: BedtimeReminder) => void;

const sinks = new Set<ReminderSink>();
/** localStorage key of the last night a reminder was shown on this device. */
export const REMINDED_KEY = 'cal.bedtimeReminded';

/**
 * Adds a sink for due reminders.
 *
 * @param sink Called once per night when the reminder is due.
 * @returns A function that removes the sink again.
 */
export function addReminderSink(sink: ReminderSink): () => void {
  sinks.add(sink);
  return () => { sinks.delete(sink); };
}

/**
 * The reminder that is due now: the night whose bedtime is less than `minutes` away and not yet reached.
 *
 * @param windows Windows around now.
 * @param nowAbs Absolute wall-clock minute of now.
 * @param minutes Reminder lead in minutes; 0 means no reminder.
 * @returns The reminder, or null.
 */
export function dueReminder(windows: readonly BedtimeWindow[], nowAbs: number, minutes: number): BedtimeReminder | null {
  if (minutes <= 0) return null;
  const w = windows.find((x) => x.start > nowAbs && x.start - minutes <= nowAbs);
  return w ? { night: w.wakeDate, inMin: w.start - nowAbs } : null;
}

/** The last reminded night stored on this device (storage may be unavailable). */
function remembered(): string | null {
  try { return localStorage.getItem(REMINDED_KEY); } catch { return null; }
}

/** Remembers a reminded night on this device. */
function remember(night: string): void {
  try { localStorage.setItem(REMINDED_KEY, night); } catch { /* private window: the in-memory mark still holds */ }
}

let scope: EffectScope | null = null;

/**
 * Starts the reminder on the active Pinia (a previous one is stopped first).
 *
 * @returns A function that stops it.
 */
export function startBedtimeReminder(): () => void {
  stopBedtimeReminder();
  const clock = useClockStore();
  const prefs = usePrefsStore();
  const ui = useUiStore();
  const windows = useBedtimeWindows(() => ({ from: clock.today, to: toIsoDate(addDays(clock.todayDate, 2)) }));
  let last = remembered();
  const offSnackbar = addReminderSink((r) => {
    ui.notify(t('bedtime.reminder', { count: r.inMin }, r.inMin), { duration: 10_000, testid: 'bedtime-reminder' });
  });

  scope = effectScope(true);
  scope.run(() => {
    watch(
      () => [clock.nowTick, prefs.bedtime, windows.value] as const,
      () => {
        // nothing while the app is hidden: the tick resumes when it is visible again
        if (typeof document !== 'undefined' && document.hidden) return;
        const due = dueReminder(windows.value, absMinutes(clock.today, clock.minutesNow), prefs.bedtime.reminderMinutes);
        if (!due || due.night === last) return;
        last = due.night;
        remember(due.night);
        for (const sink of sinks) sink(due);
      },
      { immediate: true },
    );
  });
  return () => { stopBedtimeReminder(); offSnackbar(); };
}

/** Stops the watcher started by {@link startBedtimeReminder}. */
export function stopBedtimeReminder(): void {
  scope?.stop();
  scope = null;
}
