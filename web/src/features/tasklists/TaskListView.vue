<script setup lang="ts">
import { TITLE_MAX } from '@calendar/shared/limits';
/**
 * One task list with everything that can be done to it (feature tasklist-items): head with the collapse chevron,
 * "All done", item rows, add field and footer. Used as it is by the expanded list (inside AdaptiveSheet) and by the
 * open tasks tray (one per list). All item changes go through `ops.ts` (optimistic, queued, rolled back with a
 * snackbar on failure); the tick logic (flash, celebration, support cat, markFinished) lives only here. A complete list's title is struck through
 * (`StrikeLine`, `data-struck="true"`); when the support cat comes, the line draws itself in step with its paw swipe.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IconClose, IconDragIndicator as IconGrip, IconExpandMore as IconChevron, IconDeleteOutline as IconDelete, IconEditOutline as IconEdit, IconAdd } from '@/components/icons';
import { ApiError } from '@/api/client';
import type { TaskItem, TaskList } from '@/api/types';
import { t } from '@/i18n';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useTaskCategories } from './categories';
import SupportCat from '@/features/motivation/SupportCat.vue';
import { catComes, catDuration, catSwipe, takeForcedCat } from '@/features/motivation/supportCat';
import { displayTitle } from '@/lib/items';
import { getMotionLevel, ProgressRing, RewardCheckbox, useCelebrate } from '@/motion';
import { useClockStore } from '@/stores/clock';
import { useOutboxStore } from '@/stores/outbox';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { carriedLabel, isComplete } from './format';
import { isCollapsed, setCollapsed } from './collapse';
import { addItem, moveItemTo, patchItem } from './ops';
import { useItemDrag } from './useItemDrag';
import { badgeInitial, isMemberOnly, leaveList, withNames } from './sharing';
import { useTaskListsStore } from './store';
import StrikeLine from './StrikeLine.vue';
import InkLine from './InkLine.vue';
import InkTools from './InkTools.vue';
import { useInkStore } from '@/stores/ink';
import { useInkWriting } from './useInkWriting';
import { useInkMode } from './useInkMode';
import RepeatScopeDialog from './RepeatScopeDialog.vue';
import SaveTemplateDialog from './SaveTemplateDialog.vue';
import { useRepeatScope } from './repeatScope';
import { useTaskList } from './useTaskList';

const props = defineProps<{
  id: string;
  /** The list as the host already knows it (tray: from the open endpoint); seeds the items store if it is missing. */
  list?: TaskList;
  /** Show the close button (the expanded list's sheet). */
  closable?: boolean;
  /** Tapping the title opens the task list dialog instead of renaming in place (the Tasks view). */
  titleOpensDialog?: boolean;
  /** A sticky note on the Canvas: head, celebration and the item rows only (no row buttons, add field or footer). */
  compact?: boolean;
  /** No "Save as template" in the footer: the host shows it itself (the Archive, next to "Copy"). */
  noTemplate?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  /** The list was deleted. */
  deleted: [];
  /** A tick finished the list (the celebration is playing); `catMs` is the support cat's visit length (0 = no visit). */
  completed: [catMs: number];
}>();
const sync = useSyncStore();
const pendingDeletes = usePendingDeletesStore();
const ui = useUiStore();
const clock = useClockStore();
const settings = useSettingsStore();
const lists = useTaskListsStore();
const prefs = usePrefsStore();
const ink = useInkStore();
const inkMode = useInkMode();

const root = ref<HTMLElement | null>(null);
const tl = useTaskList(() => props.id, { load: { seed: () => props.list, onClose: () => emit('close') } });
const complete = computed(() => !!tl.value && isComplete(tl.value));
/** Collapsed to the head, remembered per list and device; the expanded list's sheet (`closable`) never collapses. */
const collapsed = computed(() => !props.closable && isCollapsed(props.id));
watch(collapsed, (c) => { if (c) { adding.value = false; editingItem.value = null; } });
const carried = computed(() => !!tl.value && lists.isCarried(tl.value) && prefs.showCarriedFrom);
const cats = useTaskCategories();
const category = computed(() => settings.categoryById(tl.value ? cats.categoryId(tl.value) : null));
/** A shared list carries its owner's category look; the requester's own categories may differ. */
const icon = computed(() => (!cats.on.value ? null : (tl.value?.categoryInfo === undefined ? category.value?.icon : tl.value.categoryInfo?.icon)) ?? null);
const badge = computed(() => (tl.value ? badgeInitial(tl.value) : null));
const badgeText = computed(() => {
  const s = tl.value?.shared;
  return s ? t(s.owned ? 'sharing.badge' : 'sharing.badgeMember', { name: withNames(s.owned ? s.with : [s.owner]) }) : '';
});

onBeforeUnmount(() => {
  flashStop?.();
});

// --- ticking --------------------------------------------------------------------------------------------------
const { celebrate } = useCelebrate(() => root.value);
const flashId = ref<string | null>(null);
let flashStop: Disposer | null = null;
function tick(item: TaskItem, done: boolean) {
  const list = tl.value;
  if (!list) return;
  if (done) {
    flashId.value = item.id;
    flashStop?.();
    flashStop = appTimeout(() => { flashId.value = null; flashStop = null; }, 700);
  }
  const willComplete = done && !complete.value && list.items.every((i) => i.id === item.id || i.done);
  // a new completion strikes the title through at once unless the cat comes to do it
  strikeDraw.value = null;
  patchItem(props.id, item.id, { done });
  if (!willComplete) return;
  celebrate();
  maybeCat();
  lists.markFinished(props.id);
  emit('completed', cat.value ? catDuration(cat.value.level) : 0);
}

/** The emotional support cat: rolled once per finished list (about one in ten, every time with "Every time"), never at level Off or set to Off. */
const cat = ref<{ card: DOMRect; title: DOMRect | null; level: 'full' | 'reduced' } | null>(null);
/** The title's strike line draws itself in step with the cat's paw swipe; it stays (drawn) after the visit. */
const strikeDraw = ref<{ delay: number; duration: number } | null>(null);
function maybeCat() {
  const level = getMotionLevel();
  const forced = takeForcedCat(clock.config.testMode);
  if (!root.value || level === 'off' || !catComes({ level, setting: prefs.supportCat, forced, random: Math.random() })) return;
  const title = root.value.querySelector('[data-testid="tasklist-expanded-title"] .tx')?.getBoundingClientRect() ?? null;
  cat.value = { card: root.value.getBoundingClientRect(), title, level };
  strikeDraw.value = catSwipe(level);
}

// --- inline editing ---------------------------------------------------------------------------------------------
/** A repeating list asks "This task list / This and all following task lists" before a rename, add or remove (feature tasklist-repeating); ticks never ask. */
const scope = useRepeatScope();
// the view goes away while asking: the question goes with it (cancelled)
onBeforeUnmount(() => scope.answer(null));
const editingItem = ref<string | null>(null);
const draft = ref('');
function startEdit(item: TaskItem) {
  editingItem.value = item.id;
  draft.value = item.title;
  void nextTick(() => (root.value?.querySelector('[data-testid="tasklist-item-title-input"]') as HTMLInputElement | null)?.select());
}
async function commitEdit(item: TaskItem) {
  if (editingItem.value !== item.id) return;
  editingItem.value = null;
  const v = draft.value.trim();
  if (!v || v === item.title) return;
  const s = await scope.ask(tl.value);
  if (s) patchItem(props.id, item.id, { title: v.slice(0, TITLE_MAX) }, s);
}
function cancelEdit() { editingItem.value = null; }

/** The add field stays behind a "+" button (less clutter); it stays open for several items in a row. */
const adding = ref(false);
const newTitle = ref('');
const newInput = ref<HTMLInputElement | null>(null);
function openAdd() {
  adding.value = true;
  void nextTick(() => newInput.value?.focus());
}
function closeAdd() {
  if (!newTitle.value.trim()) adding.value = false;
}
async function add() {
  const v = newTitle.value.trim();
  newTitle.value = '';
  if (!v) return;
  const s = await scope.ask(tl.value);
  if (!s) {
    // cancelled: the typed text goes back into the add field
    adding.value = true;
    newTitle.value = v;
    return;
  }
  addItem(props.id, v.slice(0, 200), s);
  // the question took the focus (and closed the empty field): the field stays open for the next item
  const asked = !adding.value;
  adding.value = true;
  void nextTick(() => { if (asked) newInput.value?.focus(); newInput.value?.scrollIntoView?.({ block: 'nearest' }); });
}

const renaming = ref(false);
const nameDraft = ref('');
function startRename() {
  if (!tl.value) return;
  nameDraft.value = tl.value.title;
  renaming.value = true;
  void nextTick(() => (root.value?.querySelector('[data-testid="tasklist-expanded-title-input"]') as HTMLInputElement | null)?.select());
}
async function commitRename() {
  if (!renaming.value || !tl.value) return;
  renaming.value = false;
  const v = nameDraft.value.trim().slice(0, 200);
  if (!v || v === tl.value.title) return;
  const s = await scope.ask(tl.value);
  if (!s) return;
  try {
    useOutboxStore().updateList(props.id, { title: v }, s);
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('tasks.list.renameFailed'));
    if (e instanceof ApiError && e.isConflict) void sync.resyncAfterWrite();
  }
}

// --- handwriting (feature handwritten-lists) -------------------------------------------------------------------
/** Pen writing happens in the open list (the sheet) and on Canvas notes; everywhere else ink is shown read-only. */
const writing = computed(() => inkMode.enabled.value && (!!props.closable || !!props.compact));
const inkWriting = useInkWriting(() => props.id, writing, () => (tl.value?.items ?? []).filter((i) => i.ink).map((i) => i.id));
const inkLabel = (item: TaskItem, i: number): string => t(item.done ? 'ink.itemTicked' : 'ink.item', { n: i + 1, total: tl.value?.items.length ?? 0 });
// --- list actions -----------------------------------------------------------------------------------------------
function edit() { ui.openDialog('tasklist', { mode: 'edit', id: props.id }); }
/** "Save as template" (feature tasklist-templates): a small sheet over this one asks for the name. */
const savingTemplate = ref(false);
/** No confirmation: the list goes at once, the undo snackbar can bring it back (feature tasklist-editing). */
function remove() {
  if (!tl.value) return;
  pendingDeletes.deleteTaskList(tl.value);
  emit('deleted');
}
/** A member leaves a shared list: it goes away for them only (feature shared-lists). */
async function leave() {
  if (!tl.value) return;
  try {
    await leaveList(props.id);
    emit('deleted');
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('sharing.leaveFailed'));
  }
}
/** An item was dropped on place `to`: a pending item delete is sent first (the server needs every item id), then the move. */
function move(itemId: string, to: number) {
  pendingDeletes.flushList(props.id);
  moveItemTo(props.id, itemId, to);
}
useItemDrag({
  root,
  signature: () => `${collapsed.value}|${(tl.value?.items ?? []).map((i) => i.id).join(',')}`,
  gripOnly: () => !!props.compact,
  penWrites: () => writing.value,
  disabled: () => !!editingItem.value,
  onMove: move,
});
async function removeEntry(item: TaskItem, index: number) {
  const s = await scope.ask(tl.value);
  if (!s) return;
  pendingDeletes.deleteTaskItem(props.id, item, index, s);
}

/** True while a field or the scope question owns Escape (the host must not close then). */
const busy = computed(() => renaming.value || !!editingItem.value || adding.value || scope.asking.value || savingTemplate.value);
defineExpose({ root, busy });
</script>

<template>
  <section
    v-if="tl" ref="root" class="tlv" data-testid="tasklist-view" :data-tasklist-id="tl.id" :data-title="displayTitle(tl)"
    :style="{ '--c': cats.color(tl) }"
    :data-collapsed="collapsed ? 'true' : 'false'" :class="{ ruled: writing && inkMode.ruled.value, mirror: writing }"
  >
    <header class="head">
      <ProgressRing :done="tl.doneCount" :total="tl.totalCount" :size="40" :stroke="4.5" />
      <div class="titles">
        <input
          v-if="renaming" v-model="nameDraft" class="name-in" data-testid="tasklist-expanded-title-input" :maxlength="TITLE_MAX" :aria-label="t('tasks.list.titleLabel')"
          @keydown.enter.prevent="commitRename" @keydown.esc.stop.prevent="renaming = false" @blur="commitRename"
        />
        <button v-else-if="displayTitle(tl)" class="name" type="button" data-testid="tasklist-expanded-title" :data-struck="complete ? 'true' : undefined" @click="titleOpensDialog ? edit() : startRename()">
          <span v-if="icon" class="emoji" aria-hidden="true">{{ icon }}</span><span class="tx">{{ displayTitle(tl) }}<StrikeLine v-if="complete" :draw="strikeDraw" /></span>
        </button>
        <p class="sub">
          <span :key="tl.doneCount" class="cnt" data-testid="tasklist-expanded-count">{{ tl.doneCount }}/{{ tl.totalCount }}</span>
          <span v-if="carried" class="from" data-testid="tasklist-card-overdue">{{ carriedLabel(tl.date) }}</span>
          <span v-if="badge" class="shared" data-testid="tasklist-shared-badge" :title="badgeText" :aria-label="badgeText">{{ badge }}</span>
        </p>
      </div>
      <IconButton
        v-if="!closable" class="chev" :class="{ open: !collapsed }" :label="collapsed ? t('tasks.list.expand') : t('tasks.list.collapse')" :aria-expanded="!collapsed"
        data-testid="tasklist-collapse" @click="setCollapsed(id, !collapsed)"
      ><IconChevron /></IconButton>
      <IconButton v-if="closable" :label="t('tasks.list.close')" data-testid="tasklist-close" @click="emit('close')"><IconClose /></IconButton>
    </header>

    <Transition name="tlc">
      <div v-if="!collapsed" class="tlc-body">
        <p v-if="complete" class="celebrate" data-testid="tasklist-complete-message" role="status">{{ t('tasks.list.allDone') }}</p>

        <ul class="list">
          <li
            v-for="(item, i) in tl.items" :key="item.id" class="row" :class="{ ticked: item.done, flash: flashId === item.id }" data-testid="tasklist-item"
            :data-item-id="item.id" :data-title="item.title" :data-done="item.done"
          >
            <RewardCheckbox :model-value="item.done" :label="undefined" data-testid="tasklist-item-checkbox" :aria-label="item.ink ? inkLabel(item, i) : t('tasks.list.itemDone', { title: item.title })" @update:model-value="tick(item, $event)" />
            <div v-if="item.ink" class="ititle inkcell" data-testid="tasklist-item-ink" @click="!writing && tick(item, !item.done)">
              <InkLine :strokes="ink.strokes(item.id)" :editable="writing" :label="inkLabel(item, i)" @change="inkWriting.change(item.id, $event)" @tap="tick(item, !item.done)" />
            </div>
            <input
              v-else-if="editingItem === item.id" v-model="draft" class="item-in" data-testid="tasklist-item-title-input" :maxlength="TITLE_MAX" :aria-label="t('tasks.list.itemTitle')"
              @keydown.enter.prevent="commitEdit(item)" @keydown.esc.stop.prevent="cancelEdit" @blur="commitEdit(item)"
            />
            <button v-else class="ititle" type="button" data-testid="tasklist-item-title" @click="startEdit(item)"><span class="tt">{{ item.title }}</span></button>
            <span class="grip" data-item-grip data-testid="tasklist-item-grip" role="img" :aria-label="t('tasks.list.dragItem', { title: item.title })" :title="t('tasks.list.dragItem', { title: item.title })"><IconGrip /></span>
            <IconButton v-if="!compact" class="act" :label="t('tasks.list.deleteItem')" data-testid="tasklist-item-delete" @click="removeEntry(item, i)"><IconDelete /></IconButton>
          </li>
        </ul>
        <div v-if="writing && ink.mode === 'ink'" class="row nextline" data-testid="ink-next-line">
          <InkLine :strokes="inkWriting.draft.value" editable :label="t('ink.area')" @change="inkWriting.changeDraft" @tap="openAdd" />
        </div>
        <p v-if="!tl.items.length && !(writing && ink.mode === 'ink')" class="empty">{{ t('tasks.list.empty') }}</p>

        <form v-if="adding && !compact" class="add" @submit.prevent="add">
          <input
            ref="newInput" v-model="newTitle" class="new" data-testid="tasklist-new-item" type="text" enterkeyhint="done" :maxlength="TITLE_MAX"
            :placeholder="t('tasks.list.addPlaceholder')" :aria-label="t('tasks.list.newItem')" @blur="closeAdd" @keydown.esc.stop.prevent="newTitle = ''; adding = false"
          />
        </form>

        <InkTools v-if="writing && !compact" class="inktools" :can-undo="inkWriting.canUndo.value" @undo="inkWriting.undo" />

        <footer v-if="!compact" class="foot">
          <Button variant="text" class="squeeze" data-testid="tasklist-add" @click="openAdd"><template #icon><IconAdd /></template>{{ t('tasks.list.addItem') }}</Button>
          <Button v-if="!noTemplate" variant="tonal" class="tpl" data-testid="tasklist-save-template" @click="savingTemplate = true">{{ t('tasks.templates.save') }}</Button>
          <span class="grow" />
          <Button variant="text" class="squeeze" :aria-label="t('tasks.list.edit')" :title="t('tasks.list.edit')" data-testid="tasklist-edit" @click="edit"><template #icon><IconEdit /></template><span class="blab">{{ t('tasks.list.edit') }}</span></Button>
          <Button v-if="isMemberOnly(tl)" variant="text" class="danger squeeze" :aria-label="t('sharing.leave')" :title="t('sharing.leave')" data-testid="tasklist-leave" @click="leave"><template #icon><IconDelete /></template><span class="blab">{{ t('sharing.leave') }}</span></Button>
          <Button v-else variant="text" class="danger squeeze" :aria-label="t('tasks.list.delete')" :title="t('tasks.list.delete')" data-testid="tasklist-delete" @click="remove"><template #icon><IconDelete /></template><span class="blab">{{ t('tasks.list.delete') }}</span></Button>
        </footer>
      </div>
    </Transition>
    <Teleport to="body"><SupportCat v-if="cat" :card="cat.card" :title="cat.title" :level="cat.level" @done="cat = null" /></Teleport>
    <!-- on the body: inside the anchored list popover a modal would be confined to (and cover) the list -->
    <Teleport to="body"><RepeatScopeDialog :open="scope.asking.value" @answer="scope.answer" /></Teleport>
    <Teleport to="body"><SaveTemplateDialog v-if="savingTemplate" :open="savingTemplate" :list="tl" @close="savingTemplate = false" /></Teleport>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 12px; padding: 4px 0 2px; }
.chev :deep(svg) { transform: rotate(-90deg); }
.chev.open :deep(svg) { transform: none; }
/* Full motion only: a short fade of the body and a turn of the chevron; never a height animation */
html[data-motion='full'] .chev :deep(svg) { transition: transform 160ms ease-out; }
html[data-motion='full'] .tlc-enter-active, html[data-motion='full'] .tlc-leave-active { transition: opacity 160ms ease-out; }
html[data-motion='full'] .tlc-enter-from, html[data-motion='full'] .tlc-leave-to { opacity: 0; }
.titles { flex: 1; min-width: 0; }
.name { display: block; max-width: 100%; text-align: left; font: var(--md-sys-typescale-title-large); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 0; min-height: 44px; }
.name-in, .item-in, .new {
  width: 100%; min-height: 44px; font-size: 16px; color: inherit; background: var(--md-sys-color-surface-container-highest); border: 0;
  border-radius: var(--md-sys-shape-corner-small); padding: 0 14px; outline: 0; min-width: 0;
}
.name-in:focus, .item-in:focus, .new:focus { outline: 2px solid var(--md-sys-color-primary); }
.emoji { margin-right: 6px; }
/* done state: the hand-drawn strike line over the title text (drawn by the support cat's paw when it comes) */
.tx { position: relative; --strike-w: 2.400px; }
.sub { margin: 0; display: flex; gap: 8px; align-items: center; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); }
.cnt { display: inline-block; animation: bump 380ms var(--md-sys-motion-spring) both; }
.shared { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font: var(--md-sys-typescale-label-medium); background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.from { background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); border-radius: 8px; padding: 1px 8px; }
.celebrate { margin: 4px 0; padding: 10px 12px; border-radius: 12px; text-align: center; font: var(--md-sys-typescale-title-medium); background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); animation: pop 520ms var(--md-sys-motion-spring) both; }
.list { list-style: none; margin: 2px 0 0; padding: 0; }
.row { display: flex; align-items: center; gap: 4px; min-height: max(44px, calc(48px * var(--dz, 1))); border-radius: 12px; transition: background 400ms; }
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
.grip { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 44px; opacity: 0.55; cursor: grab; color: var(--md-sys-color-on-surface-variant); }
.row[data-dragging='true'] { cursor: grabbing; }
/* a long press picks a row up: no text selection or iOS callout then */
.row { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
/* the title field stays editable (iOS refuses to edit user-select: none fields) */
.row input { user-select: text; -webkit-user-select: text; }
.empty { color: var(--md-sys-color-on-surface-variant); margin: 8px 4px; }
.add { margin-top: 4px; }
.new::placeholder { color: var(--md-sys-color-on-surface-variant); }
.foot { display: flex; align-items: center; gap: 2px; margin-top: 4px; flex-wrap: wrap; container-type: inline-size; }
/* a phone-wide footer keeps one row with "Save as template" in it: Edit and Delete show their icons only (the words
   stay as their label and tooltip) */
@container (max-width: 440px) {
  .blab { display: none; }
  .foot { gap: 0; }
  .foot .squeeze { padding: 0 8px; }
  .foot .tpl { padding: 0 10px; }
}
.grow { flex: 1; }
/* an ink item: the line of ink takes the place of the title; a ticked one is struck through like a title and faded */
.inkcell { padding: 0; min-height: 0; position: relative; }
.ticked .inkcell::after { content: ''; position: absolute; left: 0; right: 0; top: 55%; height: 1.6px; background: currentColor; }
.nextline { padding-left: 44px; }
/* where a pen is used the lines are ruled and a little taller, so a word fits on one */
/* left-handed: checkbox on the right, grip on the left and a free strip before the writing, so the palm rests on the screen (decision G7) */
html[data-hand='left'][data-touch] .mirror .row { flex-direction: row-reverse; }
html[data-hand='left'][data-touch] .mirror .inkcell { margin-left: 40px; }
html[data-hand='left'][data-touch] .mirror .nextline { padding-left: 40px; padding-right: 44px; }
.ruled { --ink-h: 52px; }
.ruled .row { min-height: 52px; border-bottom: 1px solid var(--md-sys-color-outline-variant); border-radius: 0; }
.inktools { margin-top: 4px; }
/* the tonal pill sits between "Add item" and Edit/Delete; compact so the footer stays one row on a phone */
.foot .tpl { padding: 0 14px; }
.danger { color: var(--md-sys-color-error); }
@keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
@keyframes bump { 0% { transform: scale(0.7); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
@keyframes tickflash { 0% { background: color-mix(in srgb, var(--c) 38%, transparent); } 100% { background: transparent; } }
</style>
