/**
 * Canvas state (feature tasks-canvas): the person's areas (server, `GET/PUT /api/canvas`), the optimistic places of notes
 * that were just moved (the saved place lives on the task list), and the view (pan and zoom) remembered per device in
 * `localStorage`. The pure rules are in `canvas.ts`.
 */
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { api, ApiError } from '@/api/client';
import type { CanvasArea } from '@/api/types';
import { t } from '@/i18n';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { areaColor, clampArea, clampNote, DEFAULT_VIEW, parseView, VIEW_KEY, type Point, type Rect, type View } from './canvas';

/** Idle time after the last view change before it is written to `localStorage`. */
const VIEW_SAVE_MS = 250;

/** The remembered view, or the default when nothing usable is stored or the storage is blocked. */
function readView(): View {
  try {
    return parseView(localStorage.getItem(VIEW_KEY)) ?? { ...DEFAULT_VIEW };
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

/** A short random id that fits the server's pattern (`A-Za-z0-9_-`, at most 32); no `crypto.randomUUID` (insecure LAN origins). */
const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const useCanvasStore = defineStore('canvas', () => {
  const items = useItemsStore();
  const ui = useUiStore();
  const sync = useSyncStore();

  const view = ref<View>(readView());
  const areas = ref<CanvasArea[]>([]);
  /** Places of notes that were moved and are being saved; they win over the list's own place until the answer is in. */
  const placed = reactive<Record<string, Point>>({});

  // --- view ---------------------------------------------------------------------------------------------------------
  let stopSave: Disposer | null = null;
  const writeView = (): void => {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(view.value)); } catch { /* storage unavailable: the view lasts for this visit */ }
  };
  /** Shows a new view at once; it is remembered shortly after the last change (a gesture changes it every frame). */
  function setView(v: View): void {
    view.value = v;
    stopSave?.();
    stopSave = appTimeout(() => { stopSave = null; writeView(); }, VIEW_SAVE_MS);
  }
  /** Remembers the view now if a write is pending (the canvas closes). */
  function flushView(): void {
    if (!stopSave) return;
    stopSave();
    stopSave = null;
    writeView();
  }

  // --- notes --------------------------------------------------------------------------------------------------------
  /**
   * Saves a note's new place: shown at once, then written with `PATCH /api/tasklists/:id` without an etag (a move never
   * conflicts with item edits). A failure puts the note back and says so.
   */
  async function moveNote(id: string, to: Point): Promise<void> {
    placed[id] = clampNote(to);
    try {
      const saved = await api.updateTaskList(id, { canvas: placed[id] });
      const cur = items.get(id);
      // only the place and the version change: an item tick that is still in flight keeps its optimistic state
      if (cur?.kind === 'tasklist') items.upsert({ ...cur, canvas: saved.canvas, etag: saved.etag, updated: saved.updated });
      else items.upsert(saved);
    } catch (e) {
      ui.notify(e instanceof ApiError ? e.userMessage : t('canvas.moveFailed'));
    } finally {
      delete placed[id];
    }
  }

  // --- areas --------------------------------------------------------------------------------------------------------
  /** Writes go out one after the other, each with the latest document, so a slow answer never overwrites a newer edit. */
  let chain: Promise<unknown> = Promise.resolve();
  let unsaved = 0;
  function persist(): void {
    unsaved++;
    chain = chain
      .then(() => api.putCanvas(areas.value.map((a) => ({ ...a }))))
      .then((saved) => useDeviceStore().putFile('canvas', { areas: saved?.areas ?? areas.value }))
      .catch((e) => {
        ui.notify(e instanceof ApiError ? e.userMessage : t('canvas.areasNotSaved'));
        // the screen must not keep what the server refused
        return api.canvas().then((d) => { areas.value = d.areas; }).catch(() => undefined);
      })
      .finally(() => { unsaved--; });
  }

  /** Takes the areas the device holds; skipped while a local edit is still on its way (it would overwrite the edit). */
  function fromDevice(held: CanvasArea[]): void {
    if (unsaved === 0) areas.value = held;
  }

  /** Reads the areas from the device store; the server only before the device has had its first sync. */
  async function loadAreas(): Promise<void> {
    const held = useDeviceStore().file<{ areas: CanvasArea[] }>('canvas');
    if (held) return fromDevice(held.areas);
    if (unsaved > 0) return;
    try {
      const d = await api.canvas();
      if (unsaved === 0) areas.value = d.areas;
    } catch (e) {
      sync.reportError(e);
    }
  }

  /** Adds an area in `rect` (default name and the next palette colour) and saves; returns it. */
  function addArea(rect: Rect): CanvasArea {
    const a: CanvasArea = { id: newId(), name: t('canvas.area.defaultName'), color: areaColor(areas.value.length), ...clampArea(rect) };
    areas.value = [...areas.value, a];
    persist();
    return a;
  }
  /** Changes an area (name, colour, place, size) and saves; the rectangle is kept on the board. */
  function updateArea(id: string, patch: Partial<Omit<CanvasArea, 'id'>>): void {
    const cur = areas.value.find((a) => a.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    areas.value = areas.value.map((a) => (a.id === id ? { ...next, ...clampArea(next) } : a));
    persist();
  }
  function removeArea(id: string): void {
    areas.value = areas.value.filter((a) => a.id !== id);
    persist();
  }

  return { view, areas, placed, setView, flushView, moveNote, loadAreas, fromDevice, addArea, updateArea, removeArea };
});
