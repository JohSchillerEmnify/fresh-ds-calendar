/** Drag a settings list row by its grip to a new place (categories); the place logic is the task lists' (`reorder.ts`), arrow keys move one place. */
import { ref } from 'vue';
import { dropIndex, rowShifts, type RowSpan } from '@/features/tasklists';

/** `rows()` are the row elements in order; `commit(from, to)` saves a move. */
export function useRowReorder(rows: () => HTMLElement[], commit: (from: number, to: number) => void) {
  /** Per row: its shift in px while a drag is on (the lifted row follows the pointer). */
  const shifts = ref<number[]>([]);
  const lifted = ref<number | null>(null);
  let spans: RowSpan[] = [];
  let startY = 0;
  let target = 0;

  function down(i: number, e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    spans = rows().map((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
    startY = e.clientY;
    lifted.value = target = i;
    shifts.value = spans.map(() => 0);
  }
  function move(e: PointerEvent) {
    if (lifted.value === null) return;
    const from = lifted.value;
    const own = spans[from];
    target = dropIndex(spans, own.top + (own.bottom - own.top) / 2 + e.clientY - startY);
    const s = rowShifts(spans, from, target);
    s[from] = e.clientY - startY;
    shifts.value = s;
  }
  function up() {
    if (lifted.value === null) return;
    const from = lifted.value;
    lifted.value = null;
    shifts.value = [];
    if (target !== from) commit(from, target);
  }
  /** Arrow keys on the grip move the row one place, for keyboards and screen readers. */
  function key(i: number, e: KeyboardEvent, count: number) {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : i;
    if (to === i || to < 0 || to >= count) return;
    e.preventDefault();
    commit(i, to);
  }
  return { shifts, lifted, down, move, up, key };
}
