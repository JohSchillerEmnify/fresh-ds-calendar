<script setup lang="ts">
/**
 * Open tasks tray. Phone: slim bar above the navigation bar (count chip, tap to expand, list slides up).
 * Desktop: right-hand panel. Sets `--tray-h` on :root so the FAB floats above it. Hidden outside calendar views.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import IconExpand from '~icons/material-symbols/keyboard-arrow-up';
import IconToday from '~icons/material-symbols/today-outline';
import { ApiError } from '@/api/client';
import { isPhone } from '@/composables/useViewport';
import { openItem } from '@/extensions/registry';
import { vRipple } from '@/lib/ripple';
import { ProgressRing } from '@/motion';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { carriedLabel, firstOpenItem } from './format';
import { useTaskListsStore } from './store';

const route = useRoute();
const lists = useTaskListsStore();
const clock = useClockStore();
const items = useItemsStore();
const ui = useUiStore();
const shown = computed(() => !!route.meta.view);
const expanded = ref(false);
const root = ref<HTMLElement | null>(null);
const countText = computed(() => (lists.count ? `${lists.count} open` : 'No open tasks'));

let ro: ResizeObserver | null = null;
function setHeight() {
  const h = shown.value && isPhone.value && root.value ? Math.round(root.value.getBoundingClientRect().height) : 0;
  document.documentElement.style.setProperty('--tray-h', `${h}px`);
}
watch([shown, isPhone, expanded, () => lists.count], () => nextTick(setHeight));
watch(root, (el) => {
  ro?.disconnect();
  if (el && typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(setHeight);
    ro.observe(el);
  }
  setHeight();
});
onMounted(() => { void lists.refresh().catch(() => undefined); });
onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
  document.documentElement.style.removeProperty('--tray-h');
});

const label = (date: string) => (date < clock.today ? carriedLabel(date) : '');
function open(id: string) {
  const it = items.get(id);
  if (it) openItem(it);
  else ui.openDialog('tasklist-expanded', { id });
  if (isPhone.value) expanded.value = false;
}
async function today(id: string) {
  try {
    await items.updateTaskList(id, { date: clock.today });
    void lists.refresh();
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : "Couldn't move the task list.");
  }
}
</script>

<template>
  <aside v-if="shown" ref="root" class="tray" :class="{ phone: isPhone, open: expanded || !isPhone }" data-testid="task-tray" :data-expanded="expanded || !isPhone">
    <button
      v-ripple class="bar" type="button" data-testid="task-tray-toggle" :aria-expanded="expanded || !isPhone" aria-controls="task-tray-list"
      @click="expanded = !expanded"
    >
      <span class="chip" :class="{ none: !lists.count }" data-testid="task-tray-count" :data-count="lists.count">{{ countText }}</span>
      <span v-if="lists.nextTask && !expanded && isPhone" class="peek">Next: {{ lists.nextTask.item.title }}</span>
      <IconExpand class="chev" aria-hidden="true" />
    </button>
    <ul v-show="expanded || !isPhone" id="task-tray-list" class="list">
      <li v-for="l in lists.tray" :key="l.id" class="row" data-testid="task-tray-item" :data-title="l.title" :data-date="l.date" :style="{ '--c': l.color }">
        <button v-ripple class="main" type="button" @click="open(l.id)">
          <ProgressRing :done="l.doneCount" :total="l.totalCount" :size="30" :stroke="3.5" />
          <span class="txt">
            <span class="t">{{ l.title }}</span>
            <span class="s">
              <span v-if="label(l.date)" class="from">{{ label(l.date) }}</span>
              <span v-else-if="l.time">{{ l.time }}</span>
              <span v-if="firstOpenItem(l)" class="n">{{ firstOpenItem(l)!.title }}</span>
            </span>
          </span>
          <span class="c">{{ l.doneCount }}/{{ l.totalCount }}</span>
        </button>
        <button v-if="l.date < clock.today" v-ripple class="mv" type="button" aria-label="Move to today" title="Move to today" data-testid="task-tray-move-today" @click="today(l.id)"><IconToday /></button>
      </li>
      <li v-if="!lists.count" class="empty">Nothing waiting. Nice.</li>
    </ul>
  </aside>
</template>

<style scoped>
.tray { flex: none; background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface); display: flex; flex-direction: column; min-width: 0; }
.bar { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px 0 16px; width: 100%; text-align: left; }
.chip { background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); border-radius: 999px; padding: 4px 12px; font: var(--md-sys-typescale-label-large); }
.chip.none { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.peek { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-body-small); }
.chev { margin-left: auto; width: 24px; height: 24px; transition: transform 240ms var(--md-sys-motion-spring); }
.open .chev { transform: rotate(180deg); }
.list { list-style: none; margin: 0; padding: 0 8px 8px; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 2px; }
.phone .list { max-height: 42dvh; }
.row { display: flex; align-items: center; border-radius: 14px; border-left: 4px solid var(--c); background: color-mix(in srgb, var(--c) 12%, var(--md-sys-color-surface-container-high)); }
.main { flex: 1; min-width: 0; min-height: 52px; display: flex; align-items: center; gap: 10px; padding: 4px 8px; text-align: left; border-radius: 14px; }
.txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.t { font: var(--md-sys-typescale-title-small); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.s { display: flex; gap: 6px; font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); min-width: 0; }
.s .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.from { flex: none; background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); border-radius: 6px; padding: 0 6px; }
.c { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.mv { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; color: var(--md-sys-color-on-surface-variant); }
.mv :deep(svg) { width: 22px; height: 22px; }
.empty { padding: 12px 16px; color: var(--md-sys-color-on-surface-variant); }
.phone { border-top: 1px solid var(--md-sys-color-outline-variant); }
@media (min-width: 768px) {
  .tray { width: 300px; border-left: 1px solid var(--md-sys-color-outline-variant); overflow: hidden; }
  .bar { cursor: default; }
  .chev { display: none; }
  .list { flex: 1; min-height: 0; max-height: none; }
}
</style>
