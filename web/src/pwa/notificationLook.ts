/**
 * The look of a Web Push notification by its kind (feature reminders): a monochrome `badge` for the Android status bar and
 * a colour `icon`, from `public/icons/` (sources `notification-<kind>.svg`). Event = calendar page, task list = checklist,
 * morning overview = sunrise, bedtime = moon. Used by the service worker (`sw.ts`).
 */

/** The kinds a push can be; the native reminders use the same four. */
const KINDS = ['event', 'tasklist', 'summary', 'bedtime'] as const;

/**
 * The badge and icon of a push.
 *
 * @param kind The push's `kind`; a missing or unknown one (a plan sent before kinds existed) looks like an event.
 * @returns The URLs of the 96 px badge and the 192 px icon.
 */
export function notificationLook(kind: string | undefined): { badge: string; icon: string } {
  const k = KINDS.find((x) => x === kind) ?? 'event';
  return { badge: `/icons/badge-${k}-96.png`, icon: `/icons/notification-${k}-192.png` };
}
