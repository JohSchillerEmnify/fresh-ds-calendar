<script setup lang="ts">
/**
 * Expanded task list ('tasklist-expanded' dialog, props `{ id }`): bottom sheet on phones, panel anchored to the card on
 * desktop. All item changes go through `ops.ts` (optimistic, queued, rolled back with a snackbar on failure).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import IconClose from '~icons/material-symbols/close';
import IconUp from '~icons/material-symbols/keyboard-arrow-up';
import IconDown from '~icons/material-symbols/keyboard-arrow-down';
import IconDelete from '~icons/material-symbols/delete-outline';
import IconEdit from '~icons/material-symbols/edit-outline';
import IconToday from '~icons/material-symbols/today-outline';
import { api, ApiError } from '@/api/client';
import type { TaskItem } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import Chip from '@/components/m3/Chip.vue';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import IconButton from '@/components/m3/IconButton.vue';
import { isPhone } from '@/composables/useViewport';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { ProgressRing, RewardCheckbox, useCelebrate } from '@/motion';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { carriedLabel, firstOpenItem } from './format';
import { addItem, forget, moveItem, patchItem, removeItem, stableKey } from './ops';
import { useTaskListsStore } from './store';

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const ui = useUiStore();
const clock = useClockStore();
const settings = useSettingsStore();
const lists = useTaskListsStore();

const tl = computed(() => {
  const i = items.get(props.id);
  return i?.kind === 'tasklist' ? i : null;
});
const complete = computed(() => !!tl.value && tl.value.totalCount > 0 && tl.value.doneCount >= tl.value.totalCount);
const next = computed(() => (tl.value ? firstOpenItem(tl.value) : null));
const carried = computed(() => !!tl.value && lists.isCarried(tl.value));
const category = computed(() => settings.categoryById(tl.value?.categoryId));

// --- load when opened from the tray / a deep link and not cached ------------------------------
onMounted(async () => {
  if (tl.value) return;
  try {
    items.upsert(await api.getTaskList(props.id));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) ui.notify('This task list no longer exists.');
    emit('close');
  }
});

// --- placement ------------------------------------------------------------------------------------
const panel = ref<HTMLElement | null>(null);
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
const presentation = computed(() => (isPhone.value ? 'sheet' : 'popover'));
watch(isPhone, place);

let stops: Disposer[] = [];
const confirming = ref(false);
let opener: HTMLElement | null = null;
onMounted(() => {
  opener = document.activeElement as HTMLElement | null;
  place();
  void nextTick(() => panel.value?.focus({ preventScroll: true }));
  stops.push(listen(document, 'keydown', (e) => { if (e.key === 'Escape' && !confirming.value && !renaming.value && !editingItem.value) emit('close'); }));
  stops.push(listen(window, 'resize', place));
});
onBeforeUnmount(() => {
  stops.forEach((s) => s());
  stops = [];
  flashStop?.();
  forget(props.id);
  opener?.focus?.({ preventScroll: true });
});

// --- ticking ---------------------------------------------------------------------------------------
const { celebrate } = useCelebrate(() => panel.value);
const flashId = ref<string | null>(null);
let flashStop: Disposer | null = null;
function tick(item: TaskItem, done: boolean) {
  const t = tl.value;
  if (!t) return;
  if (done) {
    flashId.value = item.id;
    flashStop?.();
    flashStop = appTimeout(() => { flashId.value = null; flashStop = null; }, 700);
  }
  const willComplete = done && !complete.value && t.items.every((i) => i.id === item.id || i.done);
  patchItem(props.id, item.id, { done });
  if (willComplete) celebrate();
}

// --- inline editing -----------------------------------------------------------------------------
const editingItem = ref<string | null>(null);
const draft = ref('');
function startEdit(item: TaskItem) {
  editingItem.value = item.id;
  draft.value = item.title;
  void nextTick(() => (panel.value?.querySelector('[data-testid="tasklist-item-title-input"]') as HTMLInputElement | null)?.select());
}
function commitEdit(item: TaskItem) {
  if (editingItem.value !== item.id) return;
  editingItem.value = null;
  const v = draft.value.trim();
  if (v && v !== item.title) patchItem(props.id, item.id, { title: v.slice(0, 200) });
}
function cancelEdit() { editingItem.value = null; }

const newTitle = ref('');
const newInput = ref<HTMLInputElement | null>(null);
function add() {
  const v = newTitle.value.trim();
  newTitle.value = '';
  if (!v) return;
  addItem(props.id, v.slice(0, 200));
  void nextTick(() => newInput.value?.scrollIntoView?.({ block: 'nearest' }));
}

const renaming = ref(false);
const nameDraft = ref('');
function startRename() {
  if (!tl.value) return;
  nameDraft.value = tl.value.title;
  renaming.value = true;
  void nextTick(() => (panel.value?.querySelector('[data-testid="tasklist-expanded-title-input"]') as HTMLInputElement | null)?.select());
}
async function commitRename() {
  if (!renaming.value || !tl.value) return;
  renaming.value = false;
  const v = nameDraft.value.trim().slice(0, 200);
  if (!v || v === tl.value.title) return;
  try {
    await items.updateTaskList(props.id, { title: v });
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : "Couldn't rename the task list.");
    if (e instanceof ApiError && e.isConflict) void items.refreshVisible();
  }
}

async function moveToday() {
  try {
    await items.updateTaskList(props.id, { date: clock.today });
    void lists.refresh();
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : "Couldn't move the task list.");
  }
}
function edit() { ui.openDialog('tasklist', { mode: 'edit', id: props.id }); }
async function remove() {
  confirming.value = false;
  try {
    await items.deleteTaskList(props.id);
    lists.drop(props.id);
    emit('close');
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : "Couldn't delete the task list.");
  }
}

let startY = 0;
const dragY = ref(0);
function down(e: PointerEvent) { startY = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
function move(e: PointerEvent) { if (startY) dragY.value = Math.max(0, e.clientY - startY); }
function up() { if (dragY.value > 90) emit('close'); dragY.value = 0; startY = 0; }
const panelStyle = computed(() => {
  if (dragY.value) return { transform: `translateY(${dragY.value}px)`, transition: 'none' };
  const p = pos.value;
  return p ? { left: p.left + 'px', top: p.top + 'px', maxHeight: p.maxH + 'px' } : undefined;
});
</script>

<template>
  <div class="layer" :class="isPhone ? 'phone' : 'popover'">
    <div class="scrim" data-testid="sheet-scrim" @click="emit('close')" />
    <section
      v-if="tl" ref="panel" class="panel" :class="{ anchored: !!pos, done: complete }" role="dialog" aria-modal="true" :aria-label="tl.title" tabindex="-1"
      data-testid="tasklist-expanded" :data-tasklist-id="tl.id" :data-title="tl.title" :data-presentation="presentation"
      :style="{ '--c': tl.color, ...panelStyle }"
    >
      <div v-if="isPhone" class="handle" aria-hidden="true" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"><span /></div>
      <header class="head">
        <ProgressRing :done="tl.doneCount" :total="tl.totalCount" :size="40" :stroke="4.5" />
        <div class="titles">
          <input
            v-if="renaming" v-model="nameDraft" class="name-in" data-testid="tasklist-expanded-title-input" maxlength="200" aria-label="Task list title"
            @keydown.enter.prevent="commitRename" @keydown.esc.stop.prevent="renaming = false" @blur="commitRename"
          />
          <button v-else class="name" type="button" data-testid="tasklist-expanded-title" @click="startRename">
            <span v-if="category?.icon" class="emoji" aria-hidden="true">{{ category.icon }}</span>{{ tl.title }}
          </button>
          <p class="sub">
            <span :key="tl.doneCount" class="cnt" data-testid="tasklist-expanded-count">{{ tl.doneCount }}/{{ tl.totalCount }}</span>
            <span v-if="carried" class="from" data-testid="tasklist-card-overdue">{{ carriedLabel(tl.date) }}</span>
          </p>
        </div>
        <IconButton label="Close" data-testid="tasklist-close" @click="emit('close')"><IconClose /></IconButton>
      </header>

      <div v-if="tl.tags.length" class="tags">
        <Chip v-for="t in tl.tags" :key="t" variant="assist" data-testid="tasklist-expanded-tag" :data-name="t">{{ t }}</Chip>
      </div>

      <p v-if="complete" class="celebrate" data-testid="tasklist-complete-message" role="status">All done! 🎉</p>
      <p v-else-if="next" class="next" data-testid="tasklist-next-task">Next task: <strong>{{ next.title }}</strong></p>

      <ul class="list">
        <li
          v-for="(item, i) in tl.items" :key="stableKey(item.id)" class="row" :class="{ ticked: item.done, flash: flashId === item.id }" data-testid="tasklist-item"
          :data-item-id="item.id" :data-done="item.done"
        >
          <RewardCheckbox :model-value="item.done" :label="undefined" data-testid="tasklist-item-checkbox" :aria-label="`Done: ${item.title}`" @update:model-value="tick(item, $event)" />
          <input
            v-if="editingItem === item.id" v-model="draft" class="item-in" data-testid="tasklist-item-title-input" maxlength="200" aria-label="Item title"
            @keydown.enter.prevent="commitEdit(item)" @keydown.esc.stop.prevent="cancelEdit" @blur="commitEdit(item)"
          />
          <button v-else class="ititle" type="button" data-testid="tasklist-item-title" @click="startEdit(item)"><span class="tt">{{ item.title }}</span></button>
          <IconButton class="act" label="Move up" data-testid="tasklist-item-up" :disabled="i === 0" @click="moveItem(id, item.id, -1)"><IconUp /></IconButton>
          <IconButton class="act" label="Move down" data-testid="tasklist-item-down" :disabled="i === tl.items.length - 1" @click="moveItem(id, item.id, 1)"><IconDown /></IconButton>
          <IconButton class="act" label="Delete item" data-testid="tasklist-item-delete" @click="removeItem(id, item.id)"><IconDelete /></IconButton>
        </li>
      </ul>
      <p v-if="!tl.items.length" class="empty">No items yet. Add the first small step.</p>

      <form class="add" @submit.prevent="add">
        <input
          ref="newInput" v-model="newTitle" class="new" data-testid="tasklist-new-item" type="text" enterkeyhint="done" maxlength="200"
          placeholder="Add an item" aria-label="New item"
        />
      </form>

      <footer class="foot">
        <Button v-if="carried" variant="tonal" data-testid="tasklist-move-today" @click="moveToday"><template #icon><IconToday /></template>Move to today</Button>
        <span class="grow" />
        <Button variant="text" data-testid="tasklist-edit" @click="edit"><template #icon><IconEdit /></template>Edit</Button>
        <Button variant="text" class="danger" data-testid="tasklist-delete" @click="confirming = true"><template #icon><IconDelete /></template>Delete</Button>
      </footer>
    </section>
    <ConfirmDialog :open="confirming" :title="`Delete “${tl?.title ?? ''}”?`" message="This removes the task list from your calendar." @ok="remove" @cancel="confirming = false" />
  </div>
</template>

<style scoped>
.layer { position: fixed; inset: 0; z-index: 45; display: flex; }
.scrim { position: absolute; inset: 0; animation: fade var(--md-sys-motion-duration-medium) both; }
.phone .scrim { background: var(--md-sys-color-scrim, rgb(0 0 0 / 0.4)); }
.popover .scrim { background: rgb(0 0 0 / 0.12); }
.panel {
  position: relative; display: flex; flex-direction: column; max-height: 90dvh; outline: 0; overflow-y: auto; overscroll-behavior: contain;
  background: color-mix(in srgb, var(--c) 7%, var(--md-sys-color-surface-container-low)); color: var(--md-sys-color-on-surface);
  border-top: 4px solid var(--c);
}
.phone { align-items: flex-end; }
.phone .panel {
  width: 100%; border-radius: var(--md-sys-shape-corner-extra-large) var(--md-sys-shape-corner-extra-large) 0 0; padding: 0 16px calc(12px + var(--safe-bottom));
  animation: up 320ms var(--md-sys-motion-spring) both; transition: transform 200ms;
}
.popover { align-items: center; justify-content: center; }
.popover .panel {
  width: min(380px, calc(100vw - 16px)); padding: 12px 16px 12px; border-radius: var(--md-sys-shape-corner-extra-large); box-shadow: var(--md-sys-elevation-3);
  animation: zoom 240ms var(--md-sys-motion-spring) both; transform-origin: left top;
}
.popover .panel.anchored { position: fixed; }
.handle { display: flex; justify-content: center; padding: 10px 0 2px; touch-action: none; cursor: grab; flex: none; }
.handle span { width: 32px; height: 4px; border-radius: 2px; background: var(--md-sys-color-on-surface-variant); opacity: 0.4; }
.head { display: flex; align-items: center; gap: 12px; padding: 8px 0 4px; }
.titles { flex: 1; min-width: 0; }
.name { display: block; max-width: 100%; text-align: left; font: var(--md-sys-typescale-title-large); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 0; min-height: 44px; }
.name-in, .item-in, .new {
  width: 100%; min-height: 44px; font-size: 16px; color: inherit; background: var(--md-sys-color-surface-container-highest); border: 0;
  border-bottom: 2px solid var(--md-sys-color-primary); border-radius: 8px 8px 0 0; padding: 0 10px; outline: 0; min-width: 0;
}
.emoji { margin-right: 6px; }
.sub { margin: 0; display: flex; gap: 8px; align-items: center; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); }
.cnt { display: inline-block; animation: bump 380ms var(--md-sys-motion-spring) both; }
.from { background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); border-radius: 8px; padding: 1px 8px; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 0 8px; }
.next { margin: 4px 0 4px; padding: 8px 12px; border-radius: 12px; background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); font: var(--md-sys-typescale-body-medium); overflow: hidden; text-overflow: ellipsis; }
.celebrate { margin: 4px 0; padding: 10px 12px; border-radius: 12px; text-align: center; font: var(--md-sys-typescale-title-medium); background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); animation: pop 520ms var(--md-sys-motion-spring) both; }
.list { list-style: none; margin: 4px 0 0; padding: 0; }
.row { display: flex; align-items: center; gap: 4px; min-height: 48px; border-radius: 12px; transition: background 400ms; }
html:not([data-motion='off']) .row.flash { animation: tickflash 700ms ease-out; }
.ititle {
  flex: 1; min-width: 0; text-align: left; min-height: 44px; padding: 0 4px; overflow-wrap: anywhere; font: var(--md-sys-typescale-body-large);
}
.tt { background: linear-gradient(currentColor, currentColor) no-repeat 0 55% / 0% 1.6px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
html:not([data-motion='off']) .tt { transition: background-size 280ms cubic-bezier(0.3, 0, 0.2, 1) 60ms; }
html:not([data-motion='off']) .ititle { transition: opacity 240ms ease-out 60ms; }
.ticked .tt { background-size: 100% 1.6px; }
.ticked .ititle { opacity: 0.55; }
.item-in { flex: 1; }
.act { width: 36px; height: 44px; opacity: 0.75; }
.act:disabled { opacity: 0.2; }
.empty { color: var(--md-sys-color-on-surface-variant); margin: 8px 4px; }
.add { margin-top: 8px; }
.new::placeholder { color: var(--md-sys-color-on-surface-variant); }
.foot { display: flex; align-items: center; gap: 4px; margin-top: 12px; flex-wrap: wrap; }
.grow { flex: 1; }
.danger { color: var(--md-sys-color-error); }
@keyframes fade { from { opacity: 0; } }
@keyframes up { from { transform: translateY(100%); } }
@keyframes zoom { from { transform: scale(0.92); opacity: 0; } }
@keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
@keyframes bump { 0% { transform: scale(0.7); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
@keyframes tickflash { 0% { background: color-mix(in srgb, var(--c) 38%, transparent); } 100% { background: transparent; } }
</style>
