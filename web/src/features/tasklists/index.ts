import { defineAsyncComponent } from 'vue';
import { registerDialog, registerItemOpener, registerItemRenderer, registerTray } from '@/extensions/registry';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import TaskListCard from './TaskListCard.vue';
import './tasklists.css';
import { useTaskListsStore } from './store';

export { useTaskListsStore } from './store';
export { default as TaskListCard } from './TaskListCard.vue';

const Tray = defineAsyncComponent(() => import('./TaskTray.vue'));

/**
 * Task list UI: collapsed card renderer, expanded sheet/popover and create/edit dialog (lazy chunks),
 * open tasks tray (lazy) and its sync refresher. Called once from `extensions/builtin.ts`.
 * Needs an active Pinia.
 */
export function registerTaskListFeature(): void {
  registerItemRenderer('tasklist', TaskListCard);
  registerItemOpener('tasklist', (item) => useUiStore().revealTask(item.id));
  registerDialog('tasklist-expanded', () => import('./ExpandedTaskList.vue'));
  registerDialog('tasklist', () => import('./TaskListDialog.vue'));
  registerTray(Tray);
  useSyncStore().registerTask('open-tasks', () => useTaskListsStore().refresh());
}
