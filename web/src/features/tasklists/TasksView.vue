<script setup lang="ts">
/**
 * The Tasks view (`/tasks`, feature tasks-view): every open task list, dated or not, grouped and sorted as the
 * person chose (prefs `tasksGroupBy`, `tasksSortBy`). Each list is the tray's own `TaskListView`, so ticking and editing
 * items work as there; the title opens the task list dialog, and "Today" / "Tomorrow" give the list a date.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '@/i18n';
import { ApiError } from '@/api/client';
import type { TaskList } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import TextField from '@/components/m3/TextField.vue';
import { displayTitle, neutralName } from '@/lib/items';
import { useClockStore } from '@/stores/clock';
import { useOutboxStore } from '@/stores/outbox';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { isCollapsed, setAllCollapsed } from './collapse';
import { copyOf, matchesSearch, sortArchive } from './archive';
import { useTasksViewStore, type TasksTab } from './tasksStore';
import { groupLists, isOpen } from './tasksView';
import TaskListView from './TaskListView.vue';
import SaveTemplateDialog from './SaveTemplateDialog.vue';
import TasksCanvas from './TasksCanvas.vue';
import TasksToolbar from './TasksToolbar.vue';
import { useTaskCategories } from './categories';
import { matchesTasksFilter } from './tasksFilter';

const tasks = useTasksViewStore();
const cats = useTaskCategories();
const prefs = usePrefsStore();
const settings = useSettingsStore();
const clock = useClockStore();
const sync = useSyncStore();
const ui = useUiStore();

/** The filter bar's choice (all three tabs, feature tasks-filter). */
const passes = (l: TaskList): boolean => matchesTasksFilter(l, cats.filter.value, clock.today);
const shown = computed(() => tasks.lists.filter(passes));
const groups = computed(() => groupLists(shown.value, cats.groupBy.value, cats.sortBy.value, clock.today, settings.categories, prefs.tasksSortDir));

/** True when every list shown in the Open tab is collapsed: the toggle then offers "Expand all". */
const allCollapsed = computed(() => shown.value.length > 0 && shown.value.every((l) => isCollapsed(l.id)));

const tabOptions = computed(() => [
  { value: 'open' as TasksTab, label: t('tasks.tabs.open'), testid: 'tasks-tab-open' },
  { value: 'canvas' as TasksTab, label: t('canvas.tab'), testid: 'tasks-tab-canvas' },
  { value: 'archive' as TasksTab, label: t('tasks.tabs.archive'), testid: 'tasks-tab-archive' },
]);
const search = ref('');
const archive = computed(() => sortArchive(tasks.archived.filter((l) => passes(l) && matchesSearch(l, search.value))));

function chooseTab(next: TasksTab): void {
  tasks.setTab(next).catch((e) => sync.reportError(e));
}
/** "Copy": an open, undated copy appears in Open; the archived original stays. */
async function copy(l: TaskList): Promise<void> {
  try {
    useOutboxStore().createList(copyOf(l, cats.on.value));
    ui.notify(t('tasks.archive.copyCreated', { title: neutralName(l) }));
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('tasks.archive.copyFailed'));
  }
}
/** "Save as template" next to "Copy" (feature tasklist-templates): the finished list being saved, or null. */
const savingTemplateOf = ref<TaskList | null>(null);

let stop: (() => void) | null = null;
onMounted(() => {
  tasks.reset();
  tasks.refresh().catch((e) => sync.reportError(e));
  stop = sync.registerTask('tasks-view', () => tasks.refresh());
});
onBeforeUnmount(() => stop?.());

</script>

<template>
  <section class="tv" data-testid="tasks-view" :data-group-by="cats.groupBy.value" :data-sort-by="cats.sortBy.value" :data-sort-dir="prefs.tasksSortDir">
    <div class="controls">
      <SegmentedButton :model-value="tasks.tab" :options="tabOptions" :label="t('tasks.tabs.label')" class="tabs" @update:model-value="chooseTab" />
    </div>
    <TasksToolbar :tab="tasks.tab" :all-collapsed="allCollapsed" :can-collapse="tasks.tab === 'open' && shown.length > 0" @collapse="setAllCollapsed(shown.map((l) => l.id), !allCollapsed)" />
    <TasksCanvas v-if="tasks.tab === 'canvas'" />
    <div v-if="tasks.tab === 'archive'" class="archive" data-testid="tasks-archive">
      <div class="controls">
        <TextField v-model="search" :label="t('tasks.archive.search')" type="search" class="search" data-testid="tasks-archive-search" />
      </div>
      <div class="scroll">
        <p v-if="!archive.length" class="empty" data-testid="tasks-archive-empty">{{ search.trim() ? t('tasks.archive.noMatch') : t('tasks.archive.empty') }}</p>
        <ul class="list group">
          <li
            v-for="l in archive" :key="l.id" class="item tl-surface" data-testid="tasks-archive-item" :data-tasklist-id="l.id" :data-title="displayTitle(l)"
            :data-completed-on="l.completedOn ?? ''" :style="{ '--c': cats.color(l) }"
          >
            <TaskListView :id="l.id" :list="l" title-opens-dialog no-template class="view" />
            <div class="quick">
              <Button variant="tonal" data-testid="tasks-archive-duplicate" @click="copy(l)">{{ t('tasks.archive.copy') }}</Button>
              <Button variant="tonal" data-testid="tasklist-save-template" @click="savingTemplateOf = l">{{ t('tasks.templates.save') }}</Button>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div v-if="tasks.tab === 'open'" class="scroll">
      <p v-if="!groups.length" class="empty" data-testid="tasks-empty">{{ t('tasks.view.empty') }}</p>
      <section v-for="g in groups" :key="g.key" class="group" data-testid="tasks-group" :data-group="g.key">
        <h2 v-if="g.title" class="gt" data-testid="tasks-group-title">{{ g.title }}</h2>
        <ul class="list">
          <li
            v-for="l in g.lists" :key="l.id" class="item tl-surface" data-testid="tasks-item" :data-tasklist-id="l.id" :data-title="displayTitle(l)"
            :data-date="l.date ?? ''" :style="{ '--c': cats.color(l) }"
          >
            <TaskListView :id="l.id" :list="l" title-opens-dialog class="view" @completed="tasks.markFinished(l.id)" />
          </li>
        </ul>
      </section>
    </div>
    <Teleport to="body"><SaveTemplateDialog v-if="savingTemplateOf" :open="!!savingTemplateOf" :list="savingTemplateOf" @close="savingTemplateOf = null" /></Teleport>
  </section>
</template>

<style scoped>
.tv { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.controls { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 8px 12px; }
.tabs { flex: 1 1 220px; max-width: 360px; }
/* compact tabs (owner: "so much waste of space"): shorter, smaller label, no check mark */
.tabs :deep(.opt) { min-height: 34px; padding: 0 10px; font: var(--md-sys-typescale-label-medium); }
.tabs :deep(.chk) { display: none; }
.search { flex: 1 1 240px; max-width: 480px; }
.archive { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.archive .list { max-width: 760px; margin: 0 auto; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 12px calc(96px + var(--safe-bottom)); }
.group { max-width: 760px; margin: 0 auto 8px; }
.gt { margin: 12px 4px 8px; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface-variant); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
/* Same card as the tray's rows: category color on top, own surface tint, light shadow. */
.item { display: flex; flex-direction: column; --tl-surface-top: 4px; }
.view { padding: 0 12px 4px; }
.quick { display: flex; gap: 8px; padding: 0 12px 12px; }
.empty { max-width: 760px; margin: 24px auto; padding: 0 4px; color: var(--md-sys-color-on-surface-variant); }
</style>
