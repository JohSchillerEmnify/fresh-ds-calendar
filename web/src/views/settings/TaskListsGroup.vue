<script setup lang="ts">
/** Settings group Task lists (docs/settings-tree.md): categories, what a tap does, carried-over and finished lists, templates. */
import { computed, ref } from 'vue';
import type { Category, TaskOpen, UndatedDone } from '@/api/types';
import { IconAdd, IconDragIndicator as IconGrip } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import Pressable from '@/components/m3/Pressable.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Switch from '@/components/m3/Switch.vue';
import CategoryDialog from '@/components/settings/CategoryDialog.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import { useRowReorder } from '@/components/settings/useRowReorder';
import { moveTo } from '@/features/tasklists';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';

const settings = useSettingsStore();
const prefs = usePrefsStore();
const sync = useSyncStore();
const savePrefs = useSavePrefs();

const taskOpenOptions = computed(() => (['inline', 'drawer'] as const).map((v) => ({ value: v, label: t(`settings.tasklists.taskOpen.${v}`), testid: `settings-task-open-${v}` })));
const undatedDoneOptions = computed(() => (['calendar', 'archive'] as const).map((v) => ({ value: v, label: t(`settings.tasklists.undatedDone.${v}`), testid: `settings-undated-done-${v}` })));

const editing = ref<Category | null>(null);
const adding = ref(false);
const list = ref<HTMLElement | null>(null);
/** Categories are reordered by dragging their grip (or arrow keys on it); the new order is saved at once. */
const drag = useRowReorder(() => [...(list.value?.children ?? [])] as HTMLElement[], (from, to) => {
  settings.setCategoryOrder(moveTo(settings.categories.map((c) => c.id), from, to)).catch((e: unknown) => sync.reportError(e));
});
</script>

<template>
  <h2>{{ t('settingsNav.sub.categories') }}</h2>
  <SettingRow id="taskCategories" :label="t('settings.tasklists.taskCategories.label')" :hint="t('settings.tasklists.taskCategories.hint')">
    <Switch :model-value="prefs.taskCategories" :label="t('settings.tasklists.taskCategories.label')" data-testid="settings-task-categories" @update:model-value="savePrefs({ taskCategories: $event })" />
  </SettingRow>
  <template v-if="prefs.taskCategories">
    <ul ref="list" class="cats">
      <li
        v-for="(c, i) in settings.categories" :key="c.id" class="cat" :class="{ lifted: drag.lifted.value === i }" :style="drag.shifts.value[i] ? { transform: `translateY(${drag.shifts.value[i]}px)` } : undefined"
        data-testid="settings-category" :data-category-id="c.id" :data-name="c.name" :data-color="c.color"
      >
        <Pressable class="catmain" type="button" :aria-label="t('settings.tasklists.editCategory', { name: c.name })" @click="editing = c">
          <i class="dot" :style="{ background: c.color }" /><span v-if="c.icon" class="em">{{ c.icon }}</span><span class="nm">{{ c.name }}</span>
        </Pressable>
        <span
          class="grip" role="button" tabindex="0" :aria-label="t('settingsNav.labels.moveCategory', { name: c.name })" data-testid="settings-category-grip"
          @pointerdown="drag.down(i, $event)" @pointermove="drag.move" @pointerup="drag.up" @pointercancel="drag.up" @keydown="drag.key(i, $event, settings.categories.length)"
        ><IconGrip /></span>
      </li>
    </ul>
    <div class="add"><Button variant="tonal" data-testid="settings-category-add" @click="adding = true"><template #icon><IconAdd /></template>{{ t('settings.tasklists.addCategory') }}</Button></div>
  </template>

  <h2>{{ t('settingsNav.sub.behaviour') }}</h2>
  <SettingRow id="taskOpen" wide :label="t('settings.tasklists.taskOpen.label')">
    <SegmentedButton :model-value="prefs.taskOpen" :options="taskOpenOptions" :label="t('settings.tasklists.taskOpen.label')" data-testid="settings-task-open" @update:model-value="savePrefs({ taskOpen: $event as TaskOpen })" />
  </SettingRow>
  <SettingRow id="carriedFrom" :label="t('settings.tasklists.carriedFrom.label')" :hint="t('settings.tasklists.carriedFrom.hint')">
    <Switch :model-value="prefs.showCarriedFrom" :label="t('settings.tasklists.carriedFrom.label')" data-testid="settings-carried-from" @update:model-value="savePrefs({ showCarriedFrom: $event })" />
  </SettingRow>
  <SettingRow id="undatedDone" wide :label="t('settings.tasklists.undatedDone.label')">
    <SegmentedButton :model-value="prefs.undatedDone" :options="undatedDoneOptions" :label="t('settings.tasklists.undatedDone.label')" data-testid="settings-undated-done" @update:model-value="savePrefs({ undatedDone: $event as UndatedDone })" />
  </SettingRow>
  <SettingRow id="templates" to="/settings/templates" :label="t('tasks.templates.page')" :hint="t('tasks.templates.pageHint')" testid="settings-templates" />

  <CategoryDialog v-if="adding" @close="adding = false" />
  <CategoryDialog v-if="editing" :category="editing" @close="editing = null" />
</template>

<style scoped>
.cats { list-style: none; margin: 0; padding: 0; }
.cat { display: flex; align-items: center; padding: 0 8px 0 16px; border-radius: var(--md-sys-shape-corner-large); transition: transform var(--md-sys-motion-duration-short); }
.cat.lifted { position: relative; z-index: 1; transition: none; background: var(--md-sys-color-surface-container-high); box-shadow: var(--md-sys-elevation-2, 0 2px 6px rgb(0 0 0 / 0.3)); }
.grip { width: 48px; height: 48px; display: grid; place-items: center; flex: none; color: var(--md-sys-color-on-surface-variant); cursor: grab; touch-action: none; border-radius: 50%; }
.grip:focus-visible { outline: 2px solid var(--md-sys-color-primary); }
.catmain { flex: 1; min-height: 52px; display: flex; align-items: center; gap: 10px; text-align: left; min-width: 0; color: inherit; }
.dot { width: 16px; height: 16px; border-radius: 50%; flex: none; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--md-sys-typescale-body-large); }
.add { padding: 4px 16px 8px; }
html[data-hand='left'][data-touch] .cat { flex-direction: row-reverse; padding: 0 16px 0 8px; }
</style>
