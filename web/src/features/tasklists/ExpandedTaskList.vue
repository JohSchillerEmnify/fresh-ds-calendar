<script setup lang="ts">
/**
 * Expanded task list ('tasklist-expanded' dialog, props `{ id }`): bottom sheet on phones, panel anchored to the card on
 * desktop. Only the frame (placement, Escape, focus); the list itself is `TaskListView`, the same one the tray shows.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { api, ApiError } from '@/api/client';
import { t } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import { isPhone } from '@/composables/useViewport';
import { listen, type Disposer } from '@/lib/timers';
import { displayTitle, neutralName } from '@/lib/items';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { useTaskCategories } from './categories';
import TaskListView from './TaskListView.vue';
import { useTaskList } from './useTaskList';

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const ui = useUiStore();
const cats = useTaskCategories();

const tl = useTaskList(() => props.id, { load: { onClose: () => emit('close') }, onGone: () => emit('close') });

// --- placement ------------------------------------------------------------------------------------------------
const sheet = ref<{ panel: HTMLElement | null } | null>(null);
const view = ref<{ busy: boolean } | null>(null);
const panel = computed(() => sheet.value?.panel ?? null);
const pos = ref<{ left: number; top: number; maxH: number } | null>(null);
function place() {
  if (isPhone.value) { pos.value = null; return; }
  const card = document.querySelector(`[data-testid="tasklist-card"][data-tasklist-id="${CSS.escape(props.id)}"]`);
  const W = 380, vw = window.innerWidth, vh = window.innerHeight;
  if (!card) { pos.value = null; return; }
  const r = card.getBoundingClientRect();
  let left = r.right + 8 + W <= vw ? r.right + 8 : r.left - 8 - W >= 0 ? r.left - 8 - W : Math.min(Math.max(8, r.left), vw - W - 8);
  const top = Math.min(Math.max(8, r.top), Math.max(8, vh - 420));
  left = Math.max(8, left);
  pos.value = { left, top, maxH: vh - top - 8 };
}
watch(isPhone, place);

let stops: Disposer[] = [];
let opener: HTMLElement | null = null;
onMounted(() => {
  opener = document.activeElement as HTMLElement | null;
  place();
  void nextTick(() => panel.value?.focus({ preventScroll: true }));
  stops.push(listen(document, 'keydown', (e) => { if (e.key === 'Escape' && !view.value?.busy) emit('close'); }));
  stops.push(listen(window, 'resize', place));
});
onBeforeUnmount(() => {
  stops.forEach((s) => s());
  stops = [];
  opener?.focus?.({ preventScroll: true });
});
</script>

<template>
  <AdaptiveSheet
    ref="sheet" :open="!!tl" :label="tl ? neutralName(tl) : t('tasks.list.fallbackLabel')" testid="tasklist-expanded" :anchor="pos" :escape="false"
    :panel-attrs="{ 'data-tasklist-id': tl?.id ?? '', 'data-title': tl ? displayTitle(tl) : '' }"
    :panel-style="{ '--c': tl ? cats.color(tl) : 'transparent', borderTop: '4px solid var(--c)', background: 'color-mix(in srgb, var(--c) 7%, var(--md-sys-color-surface-container-low))' }"
    @close="emit('close')"
  >
    <TaskListView v-if="tl" :id="id" ref="view" closable @close="emit('close')" @deleted="emit('close')" />
  </AdaptiveSheet>
</template>
