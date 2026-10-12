import { defineAsyncComponent } from 'vue';
import { displayTitle } from '@/lib/items';
import { registerNowCardLine } from '@/features/calendar/nowLines';
import { registerDialog, registerItemOpener, registerItemRenderer, registerTray } from '@/extensions/registry';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import TaskListCard from './TaskListCard.vue';
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
  registerItemOpener('tasklist', (item) => useUiStore().openDialog('tasklist-expanded', { id: item.id }));
  registerDialog('tasklist-expanded', () => import('./ExpandedTaskList.vue'));
  registerDialog('tasklist', () => import('./TaskListDialog.vue'));
  registerTray(Tray);
  registerNowCardLine(() => {
    const next = useTaskListsStore().nextTask;
    return next ? `Next task: ${next.item.title} (${displayTitle(next.list)})` : null;
  });
  useSyncStore().registerTask('open-tasks', () => useTaskListsStore().refresh());
}
