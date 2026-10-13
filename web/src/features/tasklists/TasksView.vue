<script setup lang="ts">
/**
 * The Tasks view (`/tasks`, ARCHITECTURE "Tasks view"): every open task list, dated or not, grouped and sorted as the
 * person chose (prefs `tasksGroupBy`, `tasksSortBy`). Each list is the tray's own `TaskListView`, so ticking and editing
 * items work as there; the title opens the task list dialog, and "Today" / "Tomorrow" give the list a date.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { t } from '@/i18n';
import { ApiError } from '@/api/client';
import type { TaskList, TasksGroupBy, TasksSortBy, TasksSortDir } from '@/api/types';
import { IconSwapVert as IconSwap } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Select from '@/components/m3/Select.vue';
import { useFilters } from '@/composables/useFilters';
import { addDays, toIsoDate } from '@/lib/dates';
import { displayTitle } from '@/lib/items';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { useTasksViewStore } from './tasksStore';
import { groupLists, isOpen } from './tasksView';
import TaskListView from './TaskListView.vue';

const tasks = useTasksViewStore();
const items = useItemsStore();
const prefs = usePrefsStore();
const settings = useSettingsStore();
const clock = useClockStore();
const sync = useSyncStore();
const ui = useUiStore();
const filters = useFilters();

const groupOptions = computed<{ value: TasksGroupBy; label: string }[]>(() => [
  { value: 'time', label: t('tasks.view.group.time') }, { value: 'category', label: t('tasks.view.group.category') }, { value: 'none', label: t('tasks.view.group.none') },
]);
const sortOptions = computed<{ value: TasksSortBy; label: string }[]>(() => [
  { value: 'date', label: t('tasks.view.sort.date') }, { value: 'name', label: t('tasks.view.sort.name') }, { value: 'category', label: t('tasks.view.sort.category') },
  { value: 'changed', label: t('tasks.view.sort.changed') }, { value: 'progress', label: t('tasks.view.sort.progress') },
]);

const shown = computed(() => filters.apply(tasks.lists) as TaskList[]);
const groups = computed(() => groupLists(shown.value, prefs.tasksGroupBy, prefs.tasksSortBy, clock.today, settings.categories, prefs.tasksSortDir));

let stop: (() => void) | null = null;
onMounted(() => {
  tasks.reset();
  tasks.refresh().catch((e) => sync.reportError(e));
  stop = sync.registerTask('tasks-view', () => tasks.refresh());
});
onBeforeUnmount(() => stop?.());

/** Saves a choice as the person's pref; the control shows it at once and snaps back when the server refuses. */
function choose(p: { tasksGroupBy: TasksGroupBy } | { tasksSortBy: TasksSortBy } | { tasksSortDir: TasksSortDir }): void {
  prefs.set(p).catch(() => ui.notify(t('tasks.view.choiceNotSaved')));
}
async function setDate(l: TaskList, offsetDays: number): Promise<void> {
  try {
    await items.updateTaskList(l.id, { date: toIsoDate(addDays(clock.todayDate, offsetDays)) });
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('tasks.view.dateNotSet'));
  }
}
</script>

<template>
  <section class="tv" data-testid="tasks-view" :data-group-by="prefs.tasksGroupBy" :data-sort-by="prefs.tasksSortBy" :data-sort-dir="prefs.tasksSortDir">
    <div class="controls">
      <SegmentedButton
        :model-value="prefs.tasksGroupBy" :options="groupOptions" :label="t('tasks.view.groupBy')" class="gby" data-testid="tasks-group-by"
        @update:model-value="choose({ tasksGroupBy: $event })"
      />
      <Select
        :model-value="prefs.tasksSortBy" :options="sortOptions" :label="t('tasks.view.sortBy')" class="sby" data-testid="tasks-sort-by"
        @update:model-value="choose({ tasksSortBy: $event })"
      />
      <IconButton
        :label="prefs.tasksSortDir === 'reversed' ? t('tasks.view.sortDirReversed') : t('tasks.view.sortDirDefault')" :pressed="prefs.tasksSortDir === 'reversed'"
        :data-dir="prefs.tasksSortDir" data-testid="tasks-sort-dir" @click="choose({ tasksSortDir: prefs.tasksSortDir === 'reversed' ? 'default' : 'reversed' })"
      ><IconSwap /></IconButton>
    </div>
    <div class="scroll">
      <p v-if="!groups.length" class="empty" data-testid="tasks-empty">{{ t('tasks.view.empty') }}</p>
      <section v-for="g in groups" :key="g.key" class="group" data-testid="tasks-group" :data-group="g.key">
        <h2 v-if="g.title" class="gt" data-testid="tasks-group-title">{{ g.title }}</h2>
        <ul class="list">
          <li
            v-for="l in g.lists" :key="l.id" class="item" data-testid="tasks-item" :data-tasklist-id="l.id" :data-title="displayTitle(l)"
            :data-date="l.date ?? ''" :style="{ '--c': l.color }"
          >
            <TaskListView :id="l.id" :list="l" title-opens-dialog class="view" @completed="tasks.markFinished(l.id)" />
            <div v-if="isOpen(l)" class="quick">
              <Button variant="tonal" data-testid="tasks-today" @click="setDate(l, 0)">{{ t('tasks.view.today') }}</Button>
              <Button variant="tonal" data-testid="tasks-tomorrow" @click="setDate(l, 1)">{{ t('tasks.view.tomorrow') }}</Button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.tv { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.controls { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 8px 12px; }
.gby { flex: 1 1 220px; max-width: 360px; }
.sby { flex: 1 1 160px; max-width: 240px; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 12px calc(96px + var(--safe-bottom)); }
.group { max-width: 760px; margin: 0 auto 8px; }
.gt { margin: 12px 4px 8px; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface-variant); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
/* Same card as the tray's rows: category color on top, own surface tint, light shadow. */
.item {
  display: flex; flex-direction: column; border-radius: 14px; border-top: 4px solid var(--c);
  border-inline: 1px solid var(--md-sys-color-outline-variant); border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: color-mix(in srgb, var(--c) 14%, var(--md-sys-color-surface-container-highest)); box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
}
.view { padding: 0 12px 4px; }
.quick { display: flex; gap: 8px; padding: 0 12px 12px; }
.empty { max-width: 760px; margin: 24px auto; padding: 0 4px; color: var(--md-sys-color-on-surface-variant); }
</style>
