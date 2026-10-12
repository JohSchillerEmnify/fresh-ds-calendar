import IconEvent from '~icons/material-symbols/event';
import IconChecklist from '~icons/material-symbols/checklist';
import { defaultCreateRun } from './create';
import { registerCreateAction } from './registry';
import { registerCalendarFeature } from '@/features/calendar';

/**
 * Built-in registrations. Feature modules call the same `register*` functions from their own entry file
 * (imported here once they exist). The two create actions open the dialogs registered under 'event' / 'tasklist'.
 */
export function registerBuiltinExtensions(): void {
  registerCreateAction({ id: 'event', label: 'Event', icon: IconEvent, testid: 'create-menu-event', order: 10, run: defaultCreateRun('event') });
  registerCreateAction({ id: 'tasklist', label: 'Task list', icon: IconChecklist, testid: 'create-menu-tasklist', order: 20, run: defaultCreateRun('tasklist') });
  registerCalendarFeature();
}
