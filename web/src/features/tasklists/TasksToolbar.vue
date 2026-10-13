<script setup lang="ts">
/**
 * The Tasks view's one toolbar row (ARCHITECTURE "Tasks filter"), the same on Open, Canvas and Archive: a Filter button
 * (count badge, opens a bottom sheet with the category chips, When and "Clear filters"), a Group/Sort button whose label
 * summarises the choice (opens a sheet with Group by, Sort by and the direction) and a collapse/expand-all icon button.
 * While a filter is on, its chips follow in a second row, each removable. Both sheets are `AdaptiveSheet`s; the phone's
 * create button slides away while one is open.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { TasksFilter, TasksGroupBy, TasksSortBy, TasksSortDir, TasksWhen } from '@/api/types';
import { IconClose, IconFilterList as IconFilter, IconSwapVert as IconSort, IconUnfoldLess, IconUnfoldMore } from '@/components/icons';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import Chip from '@/components/m3/Chip.vue';
import IconButton from '@/components/m3/IconButton.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Select from '@/components/m3/Select.vue';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import type { TasksTab } from './tasksStore';
import { filterActive, NO_FILTER, toggleCategory, WHEN_VALUES } from './tasksFilter';

const props = defineProps<{ tab: TasksTab; allCollapsed: boolean; canCollapse: boolean }>();
const emit = defineEmits<{ collapse: [] }>();

const prefs = usePrefsStore();
const settings = useSettingsStore();
const ui = useUiStore();

const filter = computed(() => prefs.tasksFilter);
const active = computed(() => filterActive(filter.value));
const whenLabel = (w: TasksWhen): string => t(`tasks.filter.whenOption.${w}`);
const categoryName = (id: string): string => (id === 'none' ? t('tasks.noCategory') : settings.categories.find((c) => c.id === id)?.name ?? id);

// --- sheets ------------------------------------------------------------------------------------------------------------
const filterOpen = ref(false);
const sortOpen = ref(false);
watch([filterOpen, sortOpen], ([f, s]) => {
  ui.setPanel('tasks-filter-sheet', f);
  ui.setPanel('tasks-sort-sheet', s);
});
onBeforeUnmount(() => { ui.setPanel('tasks-filter-sheet', false); ui.setPanel('tasks-sort-sheet', false); });

// --- filter ------------------------------------------------------------------------------------------------------------
/** Saves a choice: the chips change at once, and snap back with a snackbar when the server refuses. */
function choose(next: TasksFilter): void {
  prefs.set({ tasksFilter: next }).catch(() => ui.notify(t('tasks.filter.saveFailed')));
}
const clear = (): void => choose({ ...NO_FILTER, categories: [] });
const chooseWhen = (w: TasksWhen): void => { if (w !== filter.value.when) choose({ ...filter.value, when: w }); };

/** One removable chip per active filter, categories first. */
const chips = computed(() => [
  ...filter.value.categories.map((id) => ({ key: `category:${id}`, label: categoryName(id), remove: () => choose(toggleCategory(filter.value, id)) })),
  ...(filter.value.when !== 'all' ? [{ key: 'when', label: whenLabel(filter.value.when), remove: () => chooseWhen('all') }] : []),
]);

// --- group and sort ----------------------------------------------------------------------------------------------------
const groupOptions = computed<{ value: TasksGroupBy; label: string }[]>(() => [
  { value: 'time', label: t('tasks.view.group.time') }, { value: 'category', label: t('tasks.view.group.category') }, { value: 'none', label: t('tasks.view.group.none') },
]);
const sortOptions = computed<{ value: TasksSortBy; label: string }[]>(() => [
  { value: 'date', label: t('tasks.view.sort.date') }, { value: 'name', label: t('tasks.view.sort.name') }, { value: 'category', label: t('tasks.view.sort.category') },
  { value: 'changed', label: t('tasks.view.sort.changed') }, { value: 'progress', label: t('tasks.view.sort.progress') },
]);
/** "Category · Date", with a mark when the order is reversed (A-146). */
const summary = computed(() => `${t(`tasks.view.group.${prefs.tasksGroupBy}`)} · ${t(`tasks.view.sort.${prefs.tasksSortBy}`)}${prefs.tasksSortDir === 'reversed' ? ' ↕' : ''}`);
function chooseOrder(p: { tasksGroupBy: TasksGroupBy } | { tasksSortBy: TasksSortBy } | { tasksSortDir: TasksSortDir }): void {
  prefs.set(p).catch(() => ui.notify(t('tasks.view.choiceNotSaved')));
}
/** Grouping and sorting apply to the Open tab only (A-144). */
const orderDisabled = computed(() => props.tab !== 'open');
</script>

<template>
  <div class="tb" data-testid="tasks-toolbar">
    <div class="row">
      <button type="button" class="btn" :class="{ on: active }" data-testid="tasks-filter-open" aria-haspopup="dialog" @click="filterOpen = true">
        <IconFilter aria-hidden="true" /><span class="lbl">{{ t('tasks.filter.label') }}</span>
        <b v-if="active" class="badge" data-testid="tasks-filter-count">{{ chips.length }}</b>
      </button>
      <button type="button" class="btn grow" data-testid="tasks-sort-open" aria-haspopup="dialog" :disabled="orderDisabled" @click="sortOpen = true">
        <IconSort aria-hidden="true" /><span class="lbl">{{ summary }}</span>
      </button>
      <IconButton
        :label="allCollapsed ? t('tasks.view.expandAll') : t('tasks.view.collapseAll')" :pressed="allCollapsed" :disabled="!canCollapse" data-testid="tasks-collapse-all"
        @click="emit('collapse')"
      ><IconUnfoldMore v-if="allCollapsed" /><IconUnfoldLess v-else /></IconButton>
    </div>
    <div v-if="chips.length" class="row active" role="group" :aria-label="t('tasks.filter.label')">
      <Chip
        v-for="c in chips" :key="c.key" selected data-testid="tasks-filter-active" :data-key="c.key" :aria-label="t('tasks.filter.remove', { name: c.label })" @click="c.remove()"
      >{{ c.label }}<IconClose class="x" aria-hidden="true" /></Chip>
    </div>

    <AdaptiveSheet :open="filterOpen" :label="t('tasks.filter.label')" testid="tasks-filter-sheet" @close="filterOpen = false">
      <div class="sheet">
        <h2 class="t">{{ t('tasks.filter.label') }}</h2>
        <h3 class="h">{{ t('tasks.filter.category') }}</h3>
        <div class="chips">
          <Chip
            v-for="c in settings.categories" :key="c.id" :selected="filter.categories.includes(c.id)" data-testid="tasks-filter-category" :data-id="c.id"
            @click="choose(toggleCategory(filter, c.id))"
          >
            <template #leading><i class="dot" :style="{ background: c.color }" /><span v-if="c.icon">{{ c.icon }}</span></template>
            {{ c.name }}
          </Chip>
          <Chip :selected="filter.categories.includes('none')" data-testid="tasks-filter-category" data-id="none" @click="choose(toggleCategory(filter, 'none'))">{{ t('tasks.noCategory') }}</Chip>
        </div>
        <h3 class="h">{{ t('tasks.filter.when') }}</h3>
        <div class="chips" role="group" :aria-label="t('tasks.filter.when')" data-testid="tasks-filter-when" :data-value="filter.when">
          <Chip v-for="w in WHEN_VALUES" :key="w" :selected="filter.when === w" data-testid="tasks-filter-when-option" :data-value="w" @click="chooseWhen(w)">{{ whenLabel(w) }}</Chip>
        </div>
        <div class="actions">
          <Button v-if="active" variant="text" data-testid="tasks-filter-clear" @click="clear">{{ t('tasks.filter.clear') }}</Button>
          <span class="grow" />
          <Button variant="tonal" data-testid="tasks-sheet-done" @click="filterOpen = false">{{ t('tasks.filter.done') }}</Button>
        </div>
      </div>
    </AdaptiveSheet>

    <AdaptiveSheet :open="sortOpen" :label="t('tasks.view.sortTitle')" testid="tasks-sort-sheet" @close="sortOpen = false">
      <div class="sheet">
        <h2 class="t">{{ t('tasks.view.sortTitle') }}</h2>
        <SegmentedButton
          :model-value="prefs.tasksGroupBy" :options="groupOptions" :label="t('tasks.view.groupBy')" data-testid="tasks-group-by"
          @update:model-value="chooseOrder({ tasksGroupBy: $event })"
        />
        <Select
          :model-value="prefs.tasksSortBy" :options="sortOptions" :label="t('tasks.view.sortBy')" data-testid="tasks-sort-by"
          @update:model-value="chooseOrder({ tasksSortBy: $event })"
        />
        <Button
          variant="outlined" :aria-pressed="prefs.tasksSortDir === 'reversed'" :data-dir="prefs.tasksSortDir" data-testid="tasks-sort-dir"
          @click="chooseOrder({ tasksSortDir: prefs.tasksSortDir === 'reversed' ? 'default' : 'reversed' })"
        >{{ prefs.tasksSortDir === 'reversed' ? t('tasks.view.sortDirReversed') : t('tasks.view.sortDirDefault') }}</Button>
        <div class="actions">
          <span class="grow" />
          <Button variant="tonal" data-testid="tasks-sheet-done" @click="sortOpen = false">{{ t('tasks.filter.done') }}</Button>
        </div>
      </div>
    </AdaptiveSheet>
  </div>
</template>

<style scoped>
.tb { padding: 0 12px 6px; display: flex; flex-direction: column; gap: 6px; }
.row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.row.active { overflow-x: auto; scrollbar-width: none; }
.row.active::-webkit-scrollbar { display: none; }
.btn {
  position: relative; flex: none; min-height: 40px; max-width: 100%; padding: 0 14px; border-radius: var(--md-sys-shape-corner-full); display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--md-sys-color-outline); color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-label-large); min-width: 0;
}
.btn.grow { flex: 0 1 auto; }
.btn.on { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); border-color: transparent; }
.btn:disabled { opacity: 0.38; }
.btn :deep(svg) { width: 20px; height: 20px; flex: none; }
.lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 10px; font: var(--md-sys-typescale-label-small); display: inline-flex; align-items: center; justify-content: center; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.x { width: 16px; height: 16px; margin-left: 4px; }
.sheet { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.h { margin: 4px 0 0; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface-variant); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 2px; }
.actions { display: flex; align-items: center; gap: 8px; }
.grow { flex: 1; }
</style>
