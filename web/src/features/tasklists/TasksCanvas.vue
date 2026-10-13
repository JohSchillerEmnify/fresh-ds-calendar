<script setup lang="ts">
/**
 * The Tasks view's Canvas tab (ARCHITECTURE "Canvas"): every open task list as a sticky note on a large board you pan and
 * zoom, with named areas. Notes keep their place on the task list itself (`cx`, `cy`); lists without one wait in the
 * Unsorted stack at the top left. The board is one layer moved with `transform` only; the pointer gestures are in
 * `useCanvasPointer.ts`, the pure geometry in `canvas.ts`, the state in `canvasStore.ts`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { t } from '@/i18n';
import type { CanvasArea as Area, TaskList } from '@/api/types';
import { IconAdd, IconDeleteOutline } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { AREA_COLORS, areaOf, centeredArea, clampArea, clampNote, clampView, placeNotes, resizeRect, type Corner, type Point, type Rect, WORLD_H, WORLD_W } from './canvas';
import { useCanvasStore } from './canvasStore';
import { matchesTasksFilter } from './tasksFilter';
import CanvasArea from './CanvasArea.vue';
import CanvasNote from './CanvasNote.vue';
import { isComplete } from './format';
import { useTasksViewStore } from './tasksStore';
import { bindCanvasPointer, type CanvasPointerHooks, type DragKind } from './useCanvasPointer';

/** How long a note that was just finished stays for the finish feedback (the celebration), before it leaves for the Archive (A-125). */
const FINISH_MS = 1400;

const tasks = useTasksViewStore();
const canvas = useCanvasStore();
const items = useItemsStore();
const sync = useSyncStore();
const ui = useUiStore();
const prefs = usePrefsStore();
const clock = useClockStore();

const viewport = ref<HTMLElement | null>(null);
const size = reactive({ w: 0, h: 0 });

// --- what is shown -------------------------------------------------------------------------------------------------
/** Ids of finished lists whose finish feedback is over: they have left the canvas. */
const leaving = reactive(new Set<string>());
const lists = computed(() => tasks.lists.filter((l) => !leaving.has(l.id)));
const byId = computed(() => new Map<string, TaskList>(lists.value.map((l) => [l.id, l])));
/** A rectangle or place that follows the pointer while something is picked up. */
const live = ref<{ kind: DragKind; id: string } & Rect | null>(null);
/** Stacking order of notes that were picked up (later = on top); not saved. */
const raised = reactive<Record<string, number>>({});
let zTop = 0;

const rects = computed(() => canvas.areas.map((a) => {
  const l = live.value && live.value.kind !== 'note' && live.value.id === a.id ? live.value : a;
  return { area: a, x: l.x, y: l.y, w: l.w, h: l.h };
}));
const notes = computed(() => placeNotes(lists.value, canvas.placed).map((n) => {
  const at: Point = live.value?.kind === 'note' && live.value.id === n.id ? live.value : n;
  const z = raised[n.id] !== undefined ? 20 + raised[n.id]! : n.placed ? 20 : 10 + Math.min(n.stack, 9);
  return { id: n.id, x: at.x, y: at.y, placed: n.placed, z, list: byId.value.get(n.id)!, area: areaOf(at, rects.value)?.area.name ?? '', dimmed: !matchesTasksFilter(byId.value.get(n.id)!, prefs.tasksFilter, clock.today) };
}));
const stacked = computed(() => notes.value.some((n) => !n.placed));

const view = computed(() => canvas.view);
const worldStyle = computed(() => ({ width: `${WORLD_W}px`, height: `${WORLD_H}px`, transform: `translate3d(${view.value.x}px, ${view.value.y}px, 0) scale(${view.value.zoom})` }));
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

// --- finishing a list on its note ------------------------------------------------------------------------------------
const timers: Disposer[] = [];
/** The tick that finished the list has played its feedback by now: the note leaves, the list is in the Archive. */
function onCompleted(id: string, catMs: number): void {
  tasks.markFinished(id);
  timers.push(appTimeout(() => {
    const l = items.get(id);
    // unticked again in the meantime: it stays
    if (l?.kind === 'tasklist' && isComplete(l)) leaving.add(id);
  }, FINISH_MS + catMs));
}

// --- pointer gestures --------------------------------------------------------------------------------------------------
let origin: Rect = { x: 0, y: 0, w: 0, h: 0 };
let corner: Corner = 'se';
/** The area whose resize handles are shown (after a long press without moving, or a click). */
const selected = ref<string | null>(null);
const rectOf = (kind: DragKind, id: string): Rect | null => {
  if (kind === 'note') {
    const n = notes.value.find((x) => x.id === id);
    return n ? { x: n.x, y: n.y, w: 0, h: 0 } : null;
  }
  const r = rects.value.find((x) => x.area.id === id);
  return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
};
/** Where a picked-up thing lies after the pointer moved by (dx, dy) board units. */
function moved(kind: DragKind, dx: number, dy: number): Rect {
  if (kind === 'note') return { ...origin, ...clampNote({ x: origin.x + dx, y: origin.y + dy }) };
  if (kind === 'area-resize') return resizeRect(origin, corner, dx, dy);
  return clampArea({ ...origin, x: origin.x + dx, y: origin.y + dy });
}
const hooks: CanvasPointerHooks = {
  getView: () => canvas.view,
  setView: (v) => canvas.setView(clampView(v, size.w, size.h)),
  viewportOrigin: () => {
    const r = viewport.value?.getBoundingClientRect();
    return { x: r?.left ?? 0, y: r?.top ?? 0 };
  },
  dragStart(kind, id, c) {
    const r = rectOf(kind, id);
    if (!r) return;
    origin = r;
    if (c) corner = c as Corner;
    live.value = { kind, id, ...r };
    if (kind === 'note') raised[id] = ++zTop;
  },
  dragMove(kind, id, dx, dy) {
    if (live.value?.id === id) live.value = { kind, id, ...moved(kind, dx, dy) };
  },
  dragEnd(kind, id, dx, dy) {
    if (live.value?.id !== id) return;
    const to = moved(kind, dx, dy);
    live.value = null;
    if (kind !== 'note') selected.value = id;
    // picked up and put down in the same place: nothing to save (an area shows its handles)
    if (to.x === origin.x && to.y === origin.y && to.w === origin.w && to.h === origin.h) return;
    if (kind === 'note') void canvas.moveNote(id, to);
    else canvas.updateArea(id, { x: to.x, y: to.y, w: to.w, h: to.h });
  },
  dragCancel() {
    live.value = null;
  },
  tap(kind, id) {
    if (kind !== 'area-head') return;
    selected.value = id;
    openEditor(id);
  },
  deselect() {
    selected.value = null;
  },
};

// --- areas ------------------------------------------------------------------------------------------------------------
const editing = ref<string | null>(null);
const editArea = computed<Area | null>(() => canvas.areas.find((a) => a.id === editing.value) ?? null);
const nameDraft = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

// the phone's create button must not cover the editor's buttons
watch(editArea, (a) => { ui.panelOpen = !!a; });
function openEditor(id: string): void {
  editing.value = id;
}
// the draft follows the area being edited; its field is focused with the name selected (a new area is renamed at once)
watch(editing, async (id) => {
  const a = canvas.areas.find((x) => x.id === id);
  if (!a) return;
  nameDraft.value = a.name;
  await nextTick();
  nameInput.value?.focus();
  nameInput.value?.select();
});
function addArea(): void {
  const a = canvas.addArea(centeredArea(canvas.view, size.w, size.h));
  selected.value = a.id;
  openEditor(a.id);
}
/** Saves the typed name when it is not empty and changed. */
function commitName(): void {
  const a = editArea.value;
  const v = nameDraft.value.trim().slice(0, 60);
  if (a && v && v !== a.name) canvas.updateArea(a.id, { name: v });
}
function finishEditing(): void {
  commitName();
  editing.value = null;
}
function removeEditing(): void {
  if (editing.value) canvas.removeArea(editing.value);
  editing.value = null;
}

// --- life cycle -------------------------------------------------------------------------------------------------------
let stopPointer: Disposer | null = null;
let stopSync: (() => void) | null = null;
let stopHide: Disposer | null = null;
let stopEsc: Disposer | null = null;
let observer: ResizeObserver | null = null;
onMounted(() => {
  const el = viewport.value!;
  size.w = el.clientWidth;
  size.h = el.clientHeight;
  observer = new ResizeObserver(() => {
    size.w = el.clientWidth;
    size.h = el.clientHeight;
  });
  observer.observe(el);
  stopPointer = bindCanvasPointer(el, hooks);
  // a reload or closed tab must not lose the last pan or zoom (the view is saved a moment after the last change)
  stopHide = listen(window, 'pagehide', () => canvas.flushView());
  stopEsc = listen(window, 'keydown', (e) => { if (e.key === 'Escape') selected.value = null; });
  void canvas.loadAreas();
  stopSync = sync.registerTask('tasks-canvas', () => canvas.loadAreas());
});
onBeforeUnmount(() => {
  ui.panelOpen = false;
  stopPointer?.();
  stopHide?.();
  stopEsc?.();
  stopSync?.();
  observer?.disconnect();
  timers.forEach((s) => s());
  canvas.flushView();
});
</script>

<template>
  <div class="canvas" data-testid="tasks-canvas">
    <div
      ref="viewport" class="viewport" data-testid="canvas-viewport" role="region" :aria-label="t('canvas.label')"
      :data-zoom="round3(view.zoom)" :data-pan-x="Math.round(view.x)" :data-pan-y="Math.round(view.y)"
    >
      <div class="world" :style="worldStyle">
        <CanvasArea
          v-for="(r, i) in rects" :key="r.area.id" :area="r.area" :x="r.x" :y="r.y" :w="r.w" :h="r.h" :z="1 + i"
          :editing="editing === r.area.id" :dragging="live?.id === r.area.id" :selected="selected === r.area.id" @edit="openEditor(r.area.id)"
        />
        <span v-if="stacked" class="unsorted" data-testid="canvas-unsorted">{{ t('canvas.unsorted') }}</span>
        <CanvasNote
          v-for="n in notes" :key="n.id" :list="n.list" :x="n.x" :y="n.y" :z="n.z" :placed="n.placed" :area="n.area" :dragging="live?.id === n.id" :dimmed="n.dimmed"
          @completed="onCompleted(n.id, $event)"
        />
      </div>
    </div>
    <p v-if="!notes.length" class="empty">{{ t('tasks.view.empty') }}</p>

    <div class="tools">
      <Button variant="tonal" data-testid="canvas-area-add" @click="addArea"><template #icon><IconAdd /></template>{{ t('canvas.addArea') }}</Button>
    </div>

    <section v-if="editArea" class="editor" data-testid="canvas-area-editor" role="group" :aria-label="t('canvas.area.editor')" @keydown.esc.stop="editing = null">
      <input
        ref="nameInput" v-model="nameDraft" class="name-in" data-testid="canvas-area-name-input" type="text" maxlength="60" enterkeyhint="done"
        :aria-label="t('canvas.area.name')" @keydown.enter.prevent="finishEditing" @blur="commitName"
      />
      <div class="swatches" role="group" :aria-label="t('canvas.area.color')">
        <button
          v-for="c in AREA_COLORS" :key="c.id" type="button" class="swatch" data-testid="canvas-area-color" :data-color="c.hex" :style="{ '--s': c.hex }"
          :aria-pressed="editArea.color === c.hex" :aria-label="t(`canvas.colors.${c.id}`)" @click="canvas.updateArea(editArea.id, { color: c.hex })"
        />
      </div>
      <div class="actions">
        <Button variant="text" class="danger" data-testid="canvas-area-delete" @click="removeEditing"><template #icon><IconDeleteOutline /></template>{{ t('canvas.area.delete') }}</Button>
        <span class="grow" />
        <Button variant="tonal" data-testid="canvas-area-editor-close" @click="finishEditing">{{ t('canvas.area.done') }}</Button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.canvas { position: relative; flex: 1; min-height: 0; overflow: hidden; }
/* touch-action none: one finger pans and two pinch here, the browser must not scroll or zoom the page instead */
.viewport { position: absolute; inset: 0; overflow: hidden; touch-action: none; overscroll-behavior: contain; background: var(--md-sys-color-surface-container-lowest, var(--md-sys-color-surface)); }
.world {
  position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; box-sizing: border-box; border: 2px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface);
  background-image: radial-gradient(circle, color-mix(in srgb, var(--md-sys-color-on-surface) 20%, transparent) 1.5px, transparent 1.5px);
  background-size: 40px 40px;
}
.unsorted { position: absolute; left: 24px; top: 2px; z-index: 5; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); pointer-events: none; }
.empty { position: absolute; left: 0; right: 0; top: 40%; margin: 0; padding: 0 24px; text-align: center; color: var(--md-sys-color-on-surface-variant); pointer-events: none; }
.tools { position: absolute; top: 8px; right: 12px; }
.editor {
  position: absolute; left: 12px; right: 12px; bottom: calc(12px + var(--safe-bottom, 0px)); max-width: 420px; margin: 0 auto; padding: 12px; border-radius: 20px;
  display: flex; flex-direction: column; gap: 12px; background: var(--md-sys-color-surface-container-high); box-shadow: 0 4px 16px rgb(0 0 0 / 0.35);
}
.name-in {
  width: 100%; box-sizing: border-box; min-height: 44px; font-size: 16px; color: inherit; background: var(--md-sys-color-surface-container-highest); border: 0;
  border-radius: var(--md-sys-shape-corner-small); padding: 0 14px; outline: 0;
}
.name-in:focus { outline: 2px solid var(--md-sys-color-primary); }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.swatch { width: 36px; height: 36px; border-radius: 50%; background: var(--s); border: 2px solid transparent; }
.swatch[aria-pressed='true'] { border-color: var(--md-sys-color-on-surface); box-shadow: 0 0 0 2px var(--md-sys-color-surface-container-high) inset; }
.actions { display: flex; align-items: center; gap: 8px; }
.grow { flex: 1; }
.danger { color: var(--md-sys-color-error); }
</style>
