<script setup lang="ts">
/**
 * The Tasks view's one filter row (ARCHITECTURE "Tasks filter"), shown under the tabs of Open, Canvas and Archive: the
 * When chip with its small menu, "Clear filters" while anything is on, and the category chips in a scrolling strip.
 * The choice is the person's pref `tasksFilter`; it is applied by the tabs, not here.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { TasksFilter, TasksWhen } from '@/api/types';
import Chip from '@/components/m3/Chip.vue';
import { t } from '@/i18n';
import { listen, type Disposer } from '@/lib/timers';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { filterActive, NO_FILTER, toggleCategory, WHEN_VALUES } from './tasksFilter';

const prefs = usePrefsStore();
const settings = useSettingsStore();
const ui = useUiStore();

const filter = computed(() => prefs.tasksFilter);
const active = computed(() => filterActive(filter.value));
const whenLabel = (w: TasksWhen): string => t(`tasks.filter.whenOption.${w}`);

/** Saves a choice: the chips change at once, and snap back with a snackbar when the server refuses. */
function choose(next: TasksFilter): void {
  prefs.set({ tasksFilter: next }).catch(() => ui.notify(t('tasks.filter.saveFailed')));
}

// --- the When menu: closes on a choice, Escape or a press outside it ---------------------------------------------------
const open = ref(false);
const wrap = ref<HTMLElement | null>(null);
let stops: Disposer[] = [];
function unbind(): void {
  stops.forEach((s) => s());
  stops = [];
}
watch(open, (o) => {
  unbind();
  if (!o) return;
  stops = [
    listen(document, 'pointerdown', (e) => { if (!wrap.value?.contains(e.target as Node)) open.value = false; }, { capture: true }),
    listen(document, 'keydown', (e) => { if (e.key === 'Escape') open.value = false; }),
  ];
});
onBeforeUnmount(unbind);

function chooseWhen(w: TasksWhen): void {
  open.value = false;
  if (w !== filter.value.when) choose({ ...filter.value, when: w });
}
</script>

<template>
  <div class="fbar" data-testid="tasks-filter-bar" role="toolbar" :aria-label="t('tasks.filter.label')">
    <span ref="wrap" class="when">
      <Chip :selected="filter.when !== 'all'" data-testid="tasks-filter-when" :data-value="filter.when" aria-haspopup="menu" :aria-expanded="open" @click="open = !open">
        {{ filter.when === 'all' ? t('tasks.filter.when') : whenLabel(filter.when) }}
      </Chip>
      <div v-if="open" class="menu" role="menu" :aria-label="t('tasks.filter.when')">
        <button
          v-for="w in WHEN_VALUES" :key="w" type="button" class="opt" role="menuitemradio" :aria-checked="filter.when === w" data-testid="tasks-filter-when-option"
          :data-value="w" @click="chooseWhen(w)"
        >{{ whenLabel(w) }}</button>
      </div>
    </span>
    <Chip v-if="active" variant="assist" data-testid="tasks-filter-clear" @click="choose({ ...NO_FILTER, categories: [] })">{{ t('tasks.filter.clear') }}</Chip>
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
  </div>
</template>

<style scoped>
.fbar { display: flex; align-items: center; gap: 8px; padding: 0 12px 6px; }
/* the When chip and Clear sit outside the scrolling strip so the menu is not clipped by its overflow */
.when { position: relative; flex: none; }
.chips { display: flex; gap: 8px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 2px; }
.menu {
  position: absolute; left: 0; top: calc(100% + 4px); z-index: 30; min-width: 168px; padding: 6px 0; border-radius: 12px;
  background: var(--md-sys-color-surface-container-high); box-shadow: 0 4px 16px rgb(0 0 0 / 0.35);
}
.opt { display: block; width: 100%; min-height: 44px; padding: 0 16px; text-align: left; font: var(--md-sys-typescale-label-large); }
.opt[aria-checked='true'] { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
</style>
