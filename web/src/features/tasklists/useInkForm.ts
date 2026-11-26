/** The ink lines of the new-list form (feature handwritten-lists): each line becomes one ink item on save; strokes can be undone. */
import { computed, ref } from 'vue';
import type { InkStroke } from '@/api/types';

/** Ruled lines shown before any is written on. */
const MIN_LINES = 4;

export function useInkForm() {
  const lines = ref<InkStroke[][]>([]);
  /** The ink items an existing list already has: they are the first lines, as they were when the form opened. */
  const existing = ref<{ id: string; strokes: InkStroke[] }[]>([]);
  /** The line each stroke went to, newest last (undo takes the last one back). */
  const history = ref<number[]>([]);
  /** The lines shown: the written ones, an empty one to write on, and enough ruled ones. */
  const shown = computed(() => {
    const out = [...lines.value];
    while (out.length < MIN_LINES || out.at(-1)?.length) out.push([]);
    return out;
  });
  function change(i: number, strokes: InkStroke[]): void {
    const next = [...lines.value];
    while (next.length <= i) next.push([]);
    if (strokes.length > (next[i]?.length ?? 0)) history.value.push(i);
    next[i] = strokes;
    lines.value = next;
  }
  function undo(): void {
    const i = history.value.pop();
    if (i !== undefined && lines.value[i]) change(i, lines.value[i]!.slice(0, -1));
  }
  /** Replaces the written lines (a template brings its ink items); the list's own ink items are then replaced too. */
  function set(next: InkStroke[][]): void {
    existing.value = [];
    lines.value = next;
    history.value = [];
  }
  /** Shows the ink items of an existing list in their lines. */
  function load(items: { id: string; strokes: InkStroke[] }[]): void {
    existing.value = items;
    lines.value = items.map((i) => i.strokes);
    history.value = [];
  }
  /** The new lines, each an ink item to create. */
  const written = computed(() => lines.value.slice(existing.value.length).filter((l) => l.length));
  /** The lines of the list's own ink items that changed, with the strokes they had. */
  const edited = computed(() => existing.value.flatMap((e, i) => (lines.value[i] && lines.value[i] !== e.strokes ? [{ id: e.id, strokes: lines.value[i]!, before: e.strokes }] : [])));
  /** Every line with strokes (what a template keeps). */
  const all = computed(() => lines.value.filter((l) => l.length));
  return { shown, change, undo, set, load, written, edited, all, canUndo: computed(() => history.value.length > 0) };
}
