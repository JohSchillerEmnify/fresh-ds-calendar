<script setup lang="ts">
/**
 * Default renderer of events and task lists (chip / all-day bar / time grid block). Replaced per kind by
 * `registerItemRenderer` once the event / task list UI exists; keeps the data-testid contract meanwhile.
 */
import { computed } from 'vue';
import type { ItemRendererProps } from '@/extensions/registry';
import { useSettingsStore } from '@/stores/settings';
import { useTaskCategories } from '@/features/tasklists/categories';
import { vRipple } from '@/lib/ripple';
import { displayTitle } from '@/lib/items';
import { showProgress } from '@/features/tasklists/format';
import { t } from '@/i18n';

const props = defineProps<ItemRendererProps>();
const emit = defineEmits<{ open: [] }>();
const settings = useSettingsStore();
const cats = useTaskCategories();
const it = computed(() => props.segment.item);
const icon = computed(() => {
  const i = it.value;
  if (i.kind !== 'tasklist' || !cats.on.value) return null;
  return (i.categoryInfo === undefined ? settings.categoryById(i.categoryId)?.icon : i.categoryInfo?.icon) ?? null;
});
const items = computed(() => {
  const i = it.value;
  return i.kind === 'tasklist' ? (i.items.length ? i.items.map((x) => x.title).join(', ') : t('calendar.item.noItems')) : '';
});
const timeText = computed(() => {
  const s = props.segment;
  if (!s.startTime) return '';
  return it.value.kind === 'event' ? `${s.startTime}–${s.endTime === '24:00' ? '00:00' : s.endTime}` : s.startTime;
});
</script>

<template>
  <button
    v-if="it.kind === 'event'" v-ripple class="item event" :class="[variant, { cont: !segment.first || !segment.last }]" type="button" data-testid="event-chip"
    :data-event-id="it.id" :data-title="it.title" :data-date="segment.date" :data-all-day="it.allDay" :data-start-time="segment.startTime ?? ''"
    :data-end-time="segment.endTime ?? ''" :data-color="it.color" :style="{ '--c': it.color }" @click.stop="emit('open')"
  >
    <span class="title" data-testid="event-chip-title">{{ it.title }}</span>
    <span v-if="variant === 'block' && timeText" class="time" data-testid="event-chip-time">{{ timeText }}</span>
  </button>
  <button
    v-else v-ripple class="item tasklist" :class="[variant, { done: it.totalCount > 0 && it.doneCount >= it.totalCount }]" type="button" data-testid="tasklist-card" :data-tasklist-id="it.id" :data-title="displayTitle(it)"
    :data-date="it.date" :data-time="it.time ?? ''" :data-color="cats.color(it)" :data-category-id="cats.categoryId(it) ?? ''" :style="{ '--c': cats.color(it) }" @click.stop="emit('open')"
  >
    <span class="head">
      <span v-if="icon" class="icon" data-testid="tasklist-card-icon">{{ icon }}</span>
      <span v-if="displayTitle(it)" class="title" data-testid="tasklist-card-title">{{ displayTitle(it) }}</span>
      <span v-if="showProgress(it)" class="count" data-testid="tasklist-card-count">{{ it.doneCount }}/{{ it.totalCount }}</span>
    </span>
    <span v-if="variant === 'block'" class="items" data-testid="tasklist-card-items">{{ items }}</span>
    <span v-if="variant === 'block' && it.time" class="time" data-testid="tasklist-card-time">{{ it.time }}</span>
  </button>
</template>

<style scoped>
.item {
  --bg: color-mix(in srgb, var(--c) 24%, var(--md-sys-color-surface));
  display: flex; min-width: 0; width: 100%; text-align: left; color: var(--md-sys-color-on-surface);
  background: var(--bg); border-radius: var(--md-sys-shape-corner-extra-small); font: var(--md-sys-typescale-label-medium);
  border-left: 3px solid var(--c); padding: 1px 4px; overflow: hidden; cursor: pointer;
}
.chip { min-height: 18px; line-height: 16px; font-size: 11px; }
.allday { min-height: 22px; align-items: center; background: var(--c); color: #fff; border-left: 0; }
.block { height: 100%; flex-direction: column; gap: 0; padding: 2px 5px; border-radius: var(--md-sys-shape-corner-small); }
.block.tasklist .head { flex: none; }
.tasklist.done { opacity: 0.55; }
.tasklist.done .title, .tasklist.done .items { text-decoration: line-through; }
.tasklist { flex-direction: column; background: color-mix(in srgb, var(--c) 20%, var(--md-sys-color-surface-container-high)); }
.head { display: flex; align-items: center; gap: 3px; min-width: 0; }
.title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.count { flex: none; font: var(--md-sys-typescale-label-small); opacity: 0.85; }
.time, .items { font-size: 11px; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icon { flex: none; }
</style>
