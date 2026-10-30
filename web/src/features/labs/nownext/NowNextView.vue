<script setup lang="ts">
/**
 * Labs: Now / Next deck (feature labs-now-next). Today as a stack of big cards: Now (the running event with the time
 * left in words and a shrinking bar, else the first open task list, else free time), Next (title, how soon, start) and
 * a folded Later card with the rest of today. A tap opens the entry like everywhere else. Always today: it loads today
 * itself and follows the app clock's minute tick (the one timer, paused while hidden). A centred column on wide screens.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { addDays } from 'date-fns';
import { useDaySegments } from '@/composables/useDaySegments';
import { IconExpandMore } from '@/components/icons';
import { openItem } from '@/extensions/registry';
import { formatDuration, hhmm } from '@/features/calendar/timeline';
import { t } from '@/i18n';
import { toIsoDate } from '@/lib/dates';
import { neutralName, type Segment } from '@/lib/items';
import { useTaskCategories } from '@/features/tasklists/categories';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import { nowNextModel } from './nowNext';

const clock = useClockStore();
const items = useItemsStore();
const sync = useSyncStore();
const segs = useDaySegments();
const model = computed(() => nowNextModel(segs(clock.today), clock.minutesNow));
const now = computed(() => model.value.now);
const laterOpen = ref(false);
const loaded = ref(false);

/** Today through the shared items store (same path as the other views); again when the date turns over. */
let loadSeq = 0;
function load(): void {
  loaded.value = false;
  // only the latest load may mark the deck loaded (a day turnover can overtake an earlier one)
  const seq = ++loadSeq;
  items.setVisible(clock.today, toIsoDate(addDays(clock.todayDate, 1)), true).then(
    () => { if (seq !== loadSeq) return; loaded.value = true; if (sync.error) sync.clearError(); },
    (e) => sync.reportError(e),
  );
}
onMounted(load);
watch(() => clock.today, load);

const cats = useTaskCategories();
/** Same colour as everywhere else (a task list follows the task-categories switch). */
const colorOf = (s: Segment) => cats.itemColor(s.item);
const open = (s: Segment) => openItem(s.item);
</script>

<template>
  <section class="deck" data-testid="nownext-view" :data-loaded="loaded" :aria-label="t('calendar.nowNext.label')">
    <!-- no cards before today's data is in: a cold open must not say "Free for the rest of today" -->
    <div v-if="loaded" class="col">
      <!-- a div, not a button: the progress bar must stay visible to screen readers; the title's button covers the card -->
      <div
        v-if="now.kind !== 'free'" class="card now tap" data-testid="nownext-now" :data-kind="now.kind"
        :data-title="now.segment.item.title" :style="{ '--c': colorOf(now.segment) }"
      >
        <span class="eyebrow">{{ t('calendar.nowNext.now') }}</span>
        <button type="button" class="title cover" data-testid="nownext-now-line" @click="open(now.segment)">{{ neutralName(now.segment.item) }}</button>
        <template v-if="now.kind === 'running'">
          <span class="big" data-testid="nownext-now-left">{{ t('calendar.nowNext.left', { left: formatDuration(now.leftMin) }) }}</span>
          <span class="barrow">
            <span
              class="bar" data-testid="nownext-bar" role="progressbar" :aria-label="t('calendar.nowNext.progress')"
              aria-valuemin="0" aria-valuemax="100" :aria-valuenow="now.leftPercent"
            ><span class="fill" :style="{ transform: `scaleX(${now.leftPercent / 100})` }" /></span>
            <span class="end">{{ now.endTime }}</span>
          </span>
          <span
            v-if="now.alsoNow.length" class="also" data-testid="nownext-also" :data-titles="now.alsoNow.map((s) => s.item.title).join(', ')"
          >{{ t('calendar.nowNext.alsoNow', { titles: now.alsoNow.map((s) => neutralName(s.item)).join(', ') }) }}</span>
        </template>
        <span v-else class="task" data-testid="nownext-task" :data-task="now.task">{{ t('calendar.nowNext.nextTask', { task: now.task }) }}</span>
      </div>
      <div v-else class="card now free" data-testid="nownext-now" data-kind="free">
        <span class="eyebrow">{{ t('calendar.nowNext.now') }}</span>
        <span class="big" data-testid="nownext-now-line">{{ now.untilMin === null ? t('calendar.nowNext.freeRest') : t('calendar.nowNext.freeUntil', { time: hhmm(now.untilMin) }) }}</span>
      </div>

      <button
        v-if="model.next" type="button" class="card next tap" data-testid="nownext-next" :data-title="model.next.segment.item.title"
        :style="{ '--c': colorOf(model.next.segment) }" @click="open(model.next.segment)"
      >
        <span class="eyebrow">{{ t('calendar.nowNext.next') }}</span>
        <span class="title">{{ neutralName(model.next.segment.item) }}</span>
        <span class="when">
          <span class="in" data-testid="nownext-next-in">{{ t('calendar.now.inDuration', { duration: formatDuration(model.next.inMin) }) }}</span>
          <span class="at" data-testid="nownext-next-time">{{ hhmm(model.next.startMin) }}</span>
        </span>
      </button>
      <div v-else-if="now.kind !== 'free'" class="card next quiet" data-testid="nownext-next">
        <span class="eyebrow">{{ t('calendar.nowNext.next') }}</span>
        <span class="title">{{ t('calendar.now.nothingElse') }}</span>
      </div>

      <div v-if="model.later.length" class="card later" data-testid="nownext-later">
        <button type="button" class="toggle" data-testid="nownext-later-toggle" :aria-expanded="laterOpen" aria-controls="nownext-later-rows" @click="laterOpen = !laterOpen">
          <span class="eyebrow">{{ t('calendar.nowNext.later') }}</span>
          <span class="more" data-testid="nownext-later-more">{{ t('calendar.nowNext.more', { count: model.later.length }) }}</span>
          <IconExpandMore class="chev" :class="{ up: laterOpen }" aria-hidden="true" />
        </button>
        <ul v-if="laterOpen" id="nownext-later-rows" class="rows">
          <li v-for="l in model.later" :key="l.segment.item.id">
            <button
              type="button" class="row" data-testid="nownext-later-item" :data-time="hhmm(l.startMin)" :data-title="l.segment.item.title"
              :style="{ '--c': colorOf(l.segment) }" @click="open(l.segment)"
            >
              <span class="at">{{ hhmm(l.startMin) }}</span><span class="rt">{{ neutralName(l.segment.item) }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.deck { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: var(--md-sys-color-surface); }
.col {
  /* bottom: room for the create button, so it never covers the Later card */
  box-sizing: border-box; min-height: 100%; max-width: 560px; margin: 0 auto; padding: 12px 16px var(--scroll-end);
  display: flex; flex-direction: column; gap: 12px;
}
.card {
  --c: var(--md-sys-color-outline);
  position: relative; box-sizing: border-box; width: 100%; margin: 0; border: none; text-align: start; font: inherit; color: var(--md-sys-color-on-surface);
  display: flex; flex-direction: column; justify-content: center; gap: 6px; min-width: 0;
  padding: 16px 20px 16px 28px; border-radius: var(--md-sys-shape-corner-extra-large, 28px);
  background: var(--md-sys-color-surface-container);
}
/* the entry's colour as a rounded stripe along the start edge */
.card.tap::before { content: ''; position: absolute; left: 12px; top: 20px; bottom: 20px; width: 6px; border-radius: 3px; background: var(--c); }
button.card { cursor: pointer; }
/* the Now card's title button reaches over the whole card, so a tap anywhere on it opens the entry */
.cover { padding: 0; border: none; background: none; color: inherit; text-align: start; cursor: pointer; }
.cover::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
.now.tap:has(.cover:focus-visible) { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
.cover:focus-visible { outline: none; }
button.card:focus-visible, .toggle:focus-visible, .row:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
.now { flex: 3 0 auto; min-height: 200px; background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.next { flex: 2 0 auto; min-height: 132px; }
.next.quiet { color: var(--md-sys-color-on-surface-variant); }
.eyebrow { font: var(--md-sys-typescale-label-large); letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.8; }
.title { font: var(--md-sys-typescale-headline-small); overflow-wrap: anywhere; }
.big { font: var(--md-sys-typescale-display-small); font-variant-numeric: tabular-nums; }
.task { font: var(--md-sys-typescale-title-medium); }
.barrow { display: flex; align-items: center; gap: 12px; margin-top: 6px; }
.bar { flex: 1; height: 12px; border-radius: 6px; background: color-mix(in srgb, var(--c) 22%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; width: 100%; background: var(--c); border-radius: 6px; transform-origin: left center; transition: transform 800ms var(--md-sys-motion-emphasized); }
html[data-motion='off'] .fill, html[data-motion='reduced'] .fill { transition: none; }
.also { font: var(--md-sys-typescale-body-large); opacity: 0.85; overflow-wrap: anywhere; }
.end { font: var(--md-sys-typescale-label-large); font-variant-numeric: tabular-nums; }
.when { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.in { font: var(--md-sys-typescale-title-large); }
.at { font: var(--md-sys-typescale-title-medium); font-variant-numeric: tabular-nums; color: var(--md-sys-color-on-surface-variant); }
.later { flex: none; padding: 4px 8px; gap: 0; }
.toggle {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 0 12px; border: none; border-radius: 20px;
  background: none; color: inherit; font: inherit; cursor: pointer; text-align: start;
}
.more { flex: 1; font: var(--md-sys-typescale-title-medium); }
.chev { width: 24px; height: 24px; transition: transform 200ms ease; }
.chev.up { transform: rotate(180deg); }
html[data-motion='off'] .chev { transition: none; }
.rows { list-style: none; margin: 0; padding: 0 0 8px; }
.row {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0 12px; border: none; border-radius: 12px;
  background: none; color: inherit; font: var(--md-sys-typescale-body-large); text-align: start; cursor: pointer;
}
.row::before { content: ''; flex: none; width: 4px; align-self: stretch; margin: 10px 0; border-radius: 2px; background: var(--c); }
.row .rt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
