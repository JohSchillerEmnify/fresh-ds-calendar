import { defineAsyncComponent } from 'vue';
import { registerDialog, registerItemOpener, registerItemRenderer, registerTray } from '@/extensions/registry';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import TaskListCard from './TaskListCard.vue';
import './tasklists.css';
import { useTaskListsStore } from './store';
import { useTemplatesStore } from './templatesStore';

export { showProgress } from './format';
export { useTaskListsStore } from './store';
export { dropIndex, moveTo, rowShifts, type RowSpan } from './reorder';

const Tray = defineAsyncComponent(() => import('./TaskTray.vue'));

/**
 * Task list UI: collapsed card renderer, expanded sheet/popover and create/edit dialog (lazy chunks),
 * open tasks tray (lazy), and the sync refreshers of the open tasks and the templates. Called once from `extensions/builtin.ts`.
 * Needs an active Pinia.
 */
export function registerTaskListFeature(): void {
  registerItemRenderer('tasklist', TaskListCard);
  registerItemOpener('tasklist', (item) => useUiStore().revealTask(item.id));
  registerDialog('tasklist-expanded', () => import('./ExpandedTaskList.vue'));
  registerDialog('tasklist', () => import('./TaskListDialog.vue'));
  registerTray(Tray);
  useSyncStore().registerTask('open-tasks', () => useTaskListsStore().refresh());
  // the templates are per-person data like the settings: fresh on every sync, so the device keeps them current
  useSyncStore().registerTask('templates', () => useTemplatesStore().load());
}
