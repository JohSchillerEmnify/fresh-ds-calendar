import { registerTaskListFeature } from '@/features/tasklists';
import { registerCalendarFeature } from '@/features/calendar';
import { registerBedtimeFeature } from '@/features/bedtime';
import { registerDialog } from '@/extensions/registry';

/**
 * Built-in registrations. Feature modules call the same `register*` functions from their own entry file
 * (imported here once they exist).
 */
export function registerBuiltinExtensions(): void {
  registerTaskListFeature();
  registerCalendarFeature();
  registerBedtimeFeature();
  registerDialog('whats-new', () => import('@/components/settings/WhatsNewSheet.vue'));
}
