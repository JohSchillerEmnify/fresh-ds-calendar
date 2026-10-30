/** The ink lines of the new-list form (feature handwritten-lists): each line becomes one ink item on save; strokes can be undone. */
import { computed, ref } from 'vue';
import type { InkStroke } from '@/api/types';

/** Ruled lines shown before any is written on. */
const MIN_LINES = 4;

export function useInkForm() {
  const lines = ref<InkStroke[][]>([]);
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
  /** Replaces the written lines (a template brings its ink items). */
  function set(next: InkStroke[][]): void {
    lines.value = next;
    history.value = [];
  }
  /** The written lines, each an ink item to create. */
  const written = computed(() => lines.value.filter((l) => l.length));
  return { shown, change, undo, set, written, canUndo: computed(() => history.value.length > 0) };
}
