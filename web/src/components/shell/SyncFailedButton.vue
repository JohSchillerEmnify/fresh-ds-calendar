<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { IconAdd, IconCheck, IconCloudOff, IconDeleteOutline, IconEditOutline } from '@/components/icons';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import IconButton from '@/components/m3/IconButton.vue';
import { t } from '@/i18n';
import { formatDate, parseIsoDate } from '@/lib/dates';
import { clampLeft } from '@/lib/clamp';
import { kindOf, type ChangeKind } from '@/lib/outbox';
import { appInterval } from '@/lib/timers';
import { useClockStore } from '@/stores/clock';
import { useOutboxStore } from '@/stores/outbox';
import { useSyncStore } from '@/stores/sync';

/** No send or sync has succeeded for this long: the icon shows (ADR 0031). */
const FAILED_AFTER_MS = 5 * 60_000;
const WIDTH = 340;
const KIND_ICONS: Record<ChangeKind, unknown> = { ticked: IconCheck, created: IconAdd, renamed: IconEditOutline, changed: IconEditOutline, deleted: IconDeleteOutline };

const sync = useSyncStore();
const outbox = useOutboxStore();
const clock = useClockStore();
const now = ref(Date.now());
const stop = appInterval(() => { now.value = Date.now(); }, 5000);
onBeforeUnmount(stop);

/** The newest success of a send or a sync. */
const lastOk = computed(() => (outbox.lastSent && outbox.lastSent.wall > sync.lastOk.wall ? outbox.lastSent : sync.lastOk));
const failed = computed(() => now.value - lastOk.value.wall >= FAILED_AFTER_MS);

const open = ref(false);
const button = ref<{ $el: HTMLElement } | null>(null);
const anchor = ref<{ left: number; top: number; maxH: number } | null>(null);
function toggle(): void {
  const r = button.value?.$el.getBoundingClientRect();
  if (r) anchor.value = { left: clampLeft(r.right - WIDTH, WIDTH, window.innerWidth, 8), top: r.bottom + 6, maxH: window.innerHeight - r.bottom - 14 };
  open.value = !open.value;
}

/** "Last synced today at 08:12" (the calendar's zone); an earlier day is named. */
const lastText = computed(() => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: clock.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(lastOk.value.app).map((x) => [x.type, x.value]));
  const time = `${p.hour}:${p.minute}`;
  const date = `${p.year}-${p.month}-${p.day}`;
  return date === clock.today ? t('outbox.lastToday', { time }) : t('outbox.lastOn', { date: formatDate(parseIsoDate(date)!, 'dayMonthShort'), time });
});
const changes = computed(() => outbox.entries.map((e) => ({ key: e.key, kind: kindOf(e.change), text: t(`outbox.change.${kindOf(e.change)}`, { title: e.title }) })));
</script>

<template>
  <template v-if="failed">
    <IconButton ref="button" class="failed" :label="t('outbox.icon')" :aria-expanded="open" data-testid="sync-failed-icon" @click="toggle"><IconCloudOff /></IconButton>
    <AdaptiveSheet :open="open" :label="t('outbox.title')" :anchor="anchor" anchored-on-phone :panel-style="{ width: `min(${WIDTH}px, calc(100vw - 16px))` }" testid="sync-failed-popover" @close="open = false">
      <h2 class="title">{{ t('outbox.title') }}</h2>
      <p class="last" data-testid="sync-failed-last">{{ lastText }}</p>
      <ul v-if="changes.length" class="list">
        <li v-for="c in changes" :key="c.key" data-testid="sync-failed-change"><component :is="KIND_ICONS[c.kind]" aria-hidden="true" /><span>{{ c.text }}</span></li>
      </ul>
      <p v-else class="empty" data-testid="sync-failed-empty">{{ t('outbox.empty') }}</p>
      <p class="hint">{{ t('outbox.hint') }}</p>
    </AdaptiveSheet>
  </template>
</template>

<style scoped>
.failed { color: var(--md-sys-color-error); }
.failed :deep(svg) { width: 20px; height: 20px; }
.title { margin: 4px 0 4px; font: var(--md-sys-typescale-title-medium); }
.last { margin: 0 0 8px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.list { margin: 0 0 8px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.list li { display: flex; align-items: center; gap: 8px; min-height: 32px; font: var(--md-sys-typescale-body-large); }
.list svg { width: 18px; height: 18px; flex: none; color: var(--md-sys-color-on-surface-variant); }
.empty { margin: 0 0 8px; font: var(--md-sys-typescale-body-large); }
.hint { margin: 0; font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); }
</style>
