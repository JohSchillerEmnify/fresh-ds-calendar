/** The lines that show the levels of subtasks (feature tasklist-subtasks): pure, so the list and its drop gap draw the same. */
import { levelOf } from '@calendar/shared/subtasks';
import type { SubtaskLines } from '@/api/types';

/** One line of a row in column `col`: a guide through the row, a branch off the task above (`end` = the last one), or a stem under a task's checkbox. */
export interface RowLine { col: number; kind: 'guide' | 'branch' | 'stem'; end?: boolean }

/** Whether a later row is at `level` before one that is less deep: the task at `level` has a next sibling. */
function hasNextAt(items: readonly object[], from: number, level: number): boolean {
  for (let i = from + 1; i < items.length; i++) {
    const l = levelOf(items[i]!);
    if (l < level) return false;
    if (l === level) return true;
  }
  return false;
}

/** The lines of the row at `index`: straight guides, one per level; tree branches, one per row plus the lines of the ancestors that continue below it. */
export function linesFor(items: readonly object[], index: number, style: SubtaskLines): RowLine[] {
  // a task with subtasks hangs a stem under its checkbox, so the lines of its subtasks start at it
  const level = levelOf(items[index]!);
  const out: RowLine[] = [];
  for (let col = 0; col < level; col++) {
    if (style === 'straight') { out.push({ col, kind: 'guide' }); continue; }
    if (col < level - 1) { if (hasNextAt(items, index, col + 1)) out.push({ col, kind: 'guide' }); continue; }
    const more = hasNextAt(items, index, level);
    out.push({ col, kind: 'branch', end: !more });
    if (more) out.push({ col, kind: 'guide' });
  }
  if (index + 1 < items.length && levelOf(items[index + 1]!) > level) out.push({ col: level, kind: 'stem' });
  return out;
}

/** The lines of the gap a dragged item will fill at `level` (no neighbours known: the branch is round). */
export function gapLines(level: number, style: SubtaskLines): RowLine[] {
  return Array.from({ length: level }, (_, col) => col)
    .flatMap((col): RowLine[] => (style === 'straight' ? [{ col, kind: 'guide' }] : col === level - 1 ? [{ col, kind: 'branch', end: true }] : []));
}
