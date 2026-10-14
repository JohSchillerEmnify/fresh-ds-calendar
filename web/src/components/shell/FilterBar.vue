<script setup lang="ts">
import { useRoute } from 'vue-router';
import Chip from '@/components/m3/Chip.vue';
import { useFilters } from '@/composables/useFilters';
import { useCalendarsStore } from '@/stores/calendars';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { t } from '@/i18n';

/** One horizontally scrolling row of filter chips; state lives in the URL query. The Tasks view offers category chips only. */
const f = useFilters();
const calendars = useCalendarsStore();
const settings = useSettingsStore();
const prefs = usePrefsStore();
const route = useRoute();
</script>

<template>
  <div class="bar" data-testid="filter-bar" role="toolbar" :aria-label="t('calendar.topBar.filters')">
    <Chip
      v-for="c in prefs.taskCategories ? settings.categories : []" :key="c.id" :selected="f.filters.value.categories.includes(c.id)" data-testid="filter-chip-category"
      :data-name="c.name" :data-category-id="c.id" @click="f.toggle('categories', c.id)"
    >
      <template #leading><i class="dot" :style="{ background: c.color }" /><span v-if="c.icon">{{ c.icon }}</span></template>
      {{ c.name }}
    </Chip>
    <Chip v-if="prefs.taskCategories" :selected="f.filters.value.categories.includes('none')" data-testid="filter-chip-category" data-name="No category" data-category-id="none" @click="f.toggle('categories', 'none')">{{ t('calendar.filter.noCategory') }}</Chip>
    <Chip
      v-for="k in route.meta.tasks ? [] : calendars.list" :key="k.id" :selected="!k.hidden" data-testid="filter-chip-calendar" :data-name="k.name" :data-calendar-id="k.id"
      @click="calendars.toggle(k.id)"
    >
      <template #leading><i class="dot" :style="{ background: k.color }" /></template>
      {{ k.name }}
    </Chip>
    <Chip v-if="f.active.value" variant="assist" data-testid="filter-clear" @click="f.clear()">{{ t('calendar.filter.clear') }}</Chip>
  </div>
</template>

<style scoped>
.bar { display: flex; gap: 8px; overflow-x: auto; padding: 6px 12px; scrollbar-width: none; background: var(--md-sys-color-surface); border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.bar::-webkit-scrollbar { display: none; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 2px; }
</style>
