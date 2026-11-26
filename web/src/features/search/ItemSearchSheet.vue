<script setup lang="ts">
/** The item search (feature item-search): a sheet on phones, a dialog on large screens; after the device results it goes on over all dates by itself. */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import ListItem from '@/components/m3/ListItem.vue';
import SearchField from '@/components/m3/SearchField.vue';
import { IconCalendarMonth, IconChecklist } from '@/components/icons';
import { openItem } from '@/extensions/registry';
import { t } from '@/i18n';
import { addDays, formatDate, parseIsoDate, routePath, toIsoDate } from '@/lib/dates';
import { useItemsStore } from '@/stores/items';
import { useItemSearch, type ResultRow } from './useItemSearch';
import { MAX_QUERY } from './useBeyondSearch';

const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const items = useItemsStore();
const list = ref<HTMLElement | null>(null);
const { query, reach, total, deviceRows, beyondRows, state, loads, lineShown, empty, failed, checkEnd } = useItemSearch(list);

const dayLabel = (iso: string): string => formatDate(parseIsoDate(iso)!, 'dayMonthYear');
/** The last day the device holds: `to` is the first day after it. */
const lastDay = computed(() => toIsoDate(addDays(parseIsoDate(reach.value.to)!, -1)));

function when(r: ResultRow): string {
  if (!r.day) return t('calendar.search.undated');
  return r.time ? t('calendar.search.when', { date: dayLabel(r.day), time: r.time }) : dayLabel(r.day);
}

/** Goes to the item's day (an undated list: the Tasks view) and opens it there; the search closes by being replaced by that dialog. */
async function choose(r: ResultRow, beyond: boolean): Promise<void> {
  await router.push(r.day ? routePath('day', parseIsoDate(r.day)!) : '/tasks');
  // an event from beyond the device is not in any loaded range yet
  if (beyond) items.upsert(r.item);
  openItem(r.item);
}
</script>

<template>
  <AdaptiveSheet :open="true" :label="t('calendar.topBar.search')" testid="item-search" @close="emit('close')">
    <div class="pane">
      <SearchField
        v-model="query" :label="t('calendar.search.label')" :clear-label="t('calendar.search.clear')" bar-testid="item-search-bar"
        data-testid="item-search-input" :maxlength="MAX_QUERY" autofocus
      />
      <p class="reach" data-testid="item-search-reach" :data-from="reach.from" :data-to="lastDay">
        {{ t('calendar.search.reach', { from: dayLabel(reach.from), to: dayLabel(lastDay) }) }}
      </p>
      <ul
        ref="list" class="list" data-testid="item-search-list" :aria-label="t('calendar.search.results')" :data-total="total" :data-state="state" :data-loads="loads" :data-query="query.trim()"
        @scroll.passive="checkEnd" @wheel.passive="checkEnd"
      >
        <li v-for="r in deviceRows" :key="r.key">
          <ListItem
            tag="button" interactive class="row" data-testid="item-search-result" :data-kind="r.item.kind" :data-title="r.item.title" :data-date="r.day ?? undefined"
            :data-item="r.itemTitle ?? undefined" :data-shared="r.shared || undefined" :data-hidden="r.hidden || undefined" @click="choose(r, false)"
          >
            <template #leading><component :is="r.item.kind === 'event' ? IconCalendarMonth : IconChecklist" aria-hidden="true" /></template>
            <span class="title">{{ r.item.title }}</span>
            <template #supporting>
              <span v-if="r.itemTitle" class="line">{{ r.itemTitle }}</span>
              <span v-else-if="r.detail" class="line">{{ r.detail }}</span>
              <span class="line">{{ when(r) }}<template v-if="r.hidden"> · {{ t('settingsNav.calendar.hidden') }}</template><template v-if="r.shared"> · {{ t('calendar.search.shared') }}</template></span>
            </template>
          </ListItem>
        </li>
        <li v-if="lineShown" class="beyond" data-testid="item-search-beyond" :data-state="state" data-limit="100">
          <template v-if="state === 'loading'">{{ t('calendar.search.loading') }}</template>
          <template v-else-if="state === 'done'">{{ t('calendar.search.done') }}</template>
          <template v-else-if="state === 'more'">{{ t('calendar.search.more') }}</template>
          <template v-else-if="state === 'offline'">{{ t('calendar.search.offline') }}</template>
          <template v-else-if="state === 'limited'">{{ t('calendar.search.limited') }}</template>
        </li>
        <li v-for="r in beyondRows" :key="r.key">
          <ListItem
            tag="button" interactive class="row" data-testid="item-search-result" :data-kind="r.item.kind" :data-title="r.item.title" :data-date="r.day ?? undefined"
            :data-hidden="r.hidden || undefined" @click="choose(r, true)"
          >
            <template #leading><IconCalendarMonth aria-hidden="true" /></template>
            <span class="title">{{ r.item.title }}</span>
            <template #supporting><span class="line">{{ when(r) }}<template v-if="r.hidden"> · {{ t('settingsNav.calendar.hidden') }}</template></span></template>
          </ListItem>
        </li>
        <li v-if="failed" class="empty" data-testid="item-search-failed">{{ t('calendar.search.failed') }}</li>
        <li v-if="empty" class="empty" data-testid="item-search-empty">{{ t('calendar.search.empty', { q: query.trim() }) }}</li>
      </ul>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.pane { display: flex; flex-direction: column; gap: 8px; height: min(70dvh, 560px); }
.reach { margin: 0; padding: 0 16px; font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); }
.list { flex: 1; min-height: 0; margin: 0; padding: 0; list-style: none; overflow-y: auto; overscroll-behavior: contain; }
.row { width: 100%; border: 0; background: transparent; text-align: left; padding-top: 8px; padding-bottom: 8px; }
.title { font: var(--md-sys-typescale-body-large); overflow-wrap: anywhere; }
.line { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beyond, .empty { padding: 12px 16px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
