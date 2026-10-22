/**
 * Bedtime reminder: "Bedtime in N minutes" once per night while the app is open. Driven by the shared clock tick
 * (`clock.nowTick`, which pauses while the app is hidden), so it has no timer of its own. The reminder is handed to a
 * list of sinks; the snackbar is the first one and a later push notification can add another without touching the
 * schedule (feature bedtime). Inside the Android app the next reminder is also handed ahead of time to the
 * native `Reminders` plugin, which shows it as a system notification when the app is closed or in the background.
 */
import { effectScope, watch, type EffectScope } from 'vue';
import { addDays, toIsoDate } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';
import { absMinutes, type BedtimeWindow } from './bedtime';
import { useBedtimeWindows } from './useBedtime';
import { t } from '@/i18n';
import { language } from '@/i18n/language';
import { remindersPlugin } from '@/native/reminders';

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

/** The next reminder still to come: the first night whose reminder time (bedtime minus the lead) lies after now. */
export interface UpcomingReminder {
  night: string;
  /** Absolute wall-clock minute the reminder is due. */
  at: number;
  /** Bedtime as `HH:MM`. */
  bedtime: string;
}

/**
 * The next reminder after now, for scheduling it ahead (the Android notification).
 *
 * @param windows Windows around now.
 * @param nowAbs Absolute wall-clock minute of now.
 * @param minutes Reminder lead in minutes; 0 means no reminder.
 * @returns The reminder, or null.
 */
export function upcomingReminder(windows: readonly BedtimeWindow[], nowAbs: number, minutes: number): UpcomingReminder | null {
  if (minutes <= 0) return null;
  const w = windows.filter((x) => x.start - minutes > nowAbs).sort((a, b) => a.start - b.start)[0];
  return w ? { night: w.wakeDate, at: w.start - minutes, bedtime: w.from.slice(11) } : null;
}

/** Id of the bedtime reminder in the native plugin (one pending at a time). */
export const NATIVE_REMINDER_ID = 'bedtime';

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

    // Android app: keep the next reminder scheduled as a system notification. The native side skips it while the app
    // is in the foreground (the snackbar shows it then). Re-sent only when it changes.
    const plugin = remindersPlugin();
    if (!plugin) return;
    let sent = '';
    watch(
      () => [clock.nowTick, prefs.bedtime, prefs.notify.bedtime, windows.value, language.value] as const,
      () => {
        const nowAbs = absMinutes(clock.today, clock.minutesNow);
        // Settings → Notifications can keep the reminder in the app only
        const next = prefs.notify.bedtime ? upcomingReminder(windows.value, nowAbs, prefs.bedtime.reminderMinutes) : null;
        if (!next) {
          if (sent !== 'none') void plugin.cancel({ id: NATIVE_REMINDER_ID }).catch(() => undefined);
          sent = 'none';
          return;
        }
        const minutes = prefs.bedtime.reminderMinutes;
        const title = t('bedtime.reminder', { count: minutes }, minutes);
        const body = t('bedtime.moon', { time: next.bedtime });
        // relative to the app clock's current minute (the wall clock of `at` is in the app's time zone)
        const at = clock.nowTick - (clock.nowTick % 60_000) + (next.at - nowAbs) * 60_000;
        const key = `${at}|${title}|${body}`;
        if (key === sent) return;
        sent = key;
        void plugin.schedule({ id: NATIVE_REMINDER_ID, at, title, body }).catch(() => undefined);
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
