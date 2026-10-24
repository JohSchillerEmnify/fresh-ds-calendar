<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import { formatDate, parseIsoDate } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { useLastKnownStore } from '@/stores/lastKnown';

const clock = useClockStore();
const lastKnown = useLastKnownStore();

/** "Last updated 08:12" (the calendar's zone); an update before today also names its day, a bare time would mislead. */
const text = computed(() => {
  const at = lastKnown.savedAt;
  if (at === null) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: clock.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).map((x) => [x.type, x.value]));
  const time = `${p.hour}:${p.minute}`;
  const date = `${p.year}-${p.month}-${p.day}`;
  return date === clock.today ? t('calendar.sync.lastUpdated', { time }) : t('calendar.sync.lastUpdatedOn', { date: formatDate(parseIsoDate(date)!, 'dayMonthShort'), time });
});
</script>

<template>
  <p v-if="lastKnown.restored && text" class="note" role="status" data-testid="last-updated-note">{{ text }}</p>
</template>

<style scoped>
.note {
  flex: none; margin: 4px 12px 0; text-align: center;
  font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant);
}
</style>
