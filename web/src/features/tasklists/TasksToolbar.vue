<script setup lang="ts">
/**
 * The Tasks view's one toolbar row (feature tasks-filter), the same on Open, Canvas and Archive: a Filter button
 * (count badge, opens a bottom sheet with the category chips, When and "Clear filters"), a Group/Sort button whose label
 * summarises the choice (opens a sheet with Group by, Sort by and the direction) and a collapse/expand-all icon button.
 * While a filter is on, its chips follow in a second row, each removable. Both sheets are `AdaptiveSheet`s; the phone's
 * create button slides away while one is open.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { TasksFilter, TasksGroupBy, TasksSortBy, TasksSortDir, TasksWhen } from '@/api/types';
import { IconClose, IconFilterList as IconFilter, IconSwapVert as IconSort, IconUnfoldLess, IconUnfoldMore } from '@/components/icons';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Badge from '@/components/m3/Badge.vue';
import Button from '@/components/m3/Button.vue';
import Chip from '@/components/m3/Chip.vue';
import IconButton from '@/components/m3/IconButton.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Select from '@/components/m3/Select.vue';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { isPhone } from '@/composables/useViewport';
import type { TasksTab } from './tasksStore';
import { useTaskCategories } from './categories';
import { filterActive, NO_FILTER, toggleCategory, WHEN_VALUES } from './tasksFilter';

const props = defineProps<{ tab: TasksTab; allCollapsed: boolean; canCollapse: boolean }>();
const emit = defineEmits<{ collapse: [] }>();

const prefs = usePrefsStore();
const settings = useSettingsStore();
const ui = useUiStore();

const cats = useTaskCategories();
/** Slides away with the bottom bar (a sheet open also takes it off the phone's screen). */
const away = computed(() => ui.barHidden || (isPhone.value && ui.panelOpen));
const filter = computed(() => cats.filter.value);
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
  // categories off: the stored category chips stay, only the shown filter changed
  prefs.set({ tasksFilter: cats.on.value ? next : { ...next, categories: prefs.tasksFilter.categories } }).catch(() => ui.notify(t('tasks.filter.saveFailed')));
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
  { value: 'time', label: t('tasks.view.group.time') }, ...(cats.on.value ? [{ value: 'category' as const, label: t('tasks.view.group.category') }] : []), { value: 'none', label: t('tasks.view.group.none') },
]);
const sortOptions = computed<{ value: TasksSortBy; label: string }[]>(() => [
  { value: 'date', label: t('tasks.view.sort.date') }, { value: 'name', label: t('tasks.view.sort.name') }, ...(cats.on.value ? [{ value: 'category' as const, label: t('tasks.view.sort.category') }] : []),
  { value: 'changed', label: t('tasks.view.sort.changed') }, { value: 'progress', label: t('tasks.view.sort.progress') },
]);
/** "Category · Date", with a mark when the order is reversed (feature tasks-filter). */
const summary = computed(() => `${t(`tasks.view.group.${cats.groupBy.value}`)} · ${t(`tasks.view.sort.${cats.sortBy.value}`)}${prefs.tasksSortDir === 'reversed' ? ' ↕' : ''}`);
function chooseOrder(p: { tasksGroupBy: TasksGroupBy } | { tasksSortBy: TasksSortBy } | { tasksSortDir: TasksSortDir }): void {
  prefs.set(p).catch(() => ui.notify(t('tasks.view.choiceNotSaved')));
}
/** Grouping and sorting apply to the Open tab only (feature tasks-filter). */
const orderDisabled = computed(() => props.tab !== 'open');
</script>

<template>
  <div class="tb" data-testid="tasks-toolbar">
    <p v-if="!orderDisabled" class="summary" data-testid="tasks-sort-summary">{{ summary }}</p>
    <div class="ftb" :class="{ away }" role="group" :aria-label="t('tasks.view.toolbar')" data-testid="tasks-floating-toolbar" :data-hidden="away ? 'true' : 'false'" :inert="away">
      <IconButton :label="active ? t('tasks.filter.labelActive', { count: chips.length }) : t('tasks.filter.label')" :variant="active ? 'tonal' : undefined" data-testid="tasks-filter-open" aria-haspopup="dialog" @click="filterOpen = true">
        <IconFilter /><Badge v-if="active" :label="chips.length" data-testid="tasks-filter-count" />
      </IconButton>
      <IconButton :label="t('tasks.view.sortLabel')" :disabled="orderDisabled" data-testid="tasks-sort-open" aria-haspopup="dialog" @click="sortOpen = true"><IconSort /></IconButton>
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
        <h3 v-if="cats.on.value" class="h">{{ t('tasks.filter.category') }}</h3>
        <div v-if="cats.on.value" class="chips">
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
          :model-value="cats.groupBy.value" :options="groupOptions" :label="t('tasks.view.groupBy')" data-testid="tasks-group-by"
          @update:model-value="chooseOrder({ tasksGroupBy: $event })"
        />
        <Select
          :model-value="cats.sortBy.value" :options="sortOptions" :label="t('tasks.view.sortBy')" data-testid="tasks-sort-by"
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
/* floats beside the + button, same height; only the + is filled (feature tasks-toolbar) */
.summary { margin: 0; padding: 0 8px; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); }
.ftb {
  position: fixed; z-index: 30; left: calc(16px + var(--safe-left)); bottom: calc(var(--navbar-h) + var(--safe-bottom) + 12px); height: 64px; box-sizing: border-box; padding: 0 8px;
  display: flex; align-items: center; gap: 4px; border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-surface-container-high); box-shadow: var(--md-sys-elevation-2);
  transition: transform 220ms var(--md-sys-motion-spring), opacity 160ms linear;
}
.ftb.away { transform: translateY(calc(100% + 24px + var(--safe-bottom))); opacity: 0; pointer-events: none; }
.ftb :deep(.icon-btn) { width: 48px; height: 48px; position: relative; }
html[data-hand='left'][data-touch] .ftb { left: auto; right: calc(16px + var(--safe-right)); }
html[data-nav-pos='rail'] .ftb { left: calc(var(--rail-w) + 16px + var(--safe-left)); }
@media (min-width: 768px) { .ftb { bottom: calc(var(--navbar-h) + var(--safe-bottom) + 24px); } }
.x { width: 16px; height: 16px; margin-left: 4px; }
.sheet { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.h { margin: 4px 0 0; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface-variant); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 2px; }
.actions { display: flex; align-items: center; gap: 8px; }
.grow { flex: 1; }
</style>
