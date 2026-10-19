import type { DataTable } from 'playwright-bdd';

export interface ItemInput { title: string; done: boolean }

/** `| item | done |` tables; a header-less single-column table lists undone item titles. */
export function itemsFrom(table: DataTable): ItemInput[] {
  const raw = table.raw();
  if (raw[0]?.length === 1 && raw[0][0] !== 'item') return raw.map((r) => ({ title: r[0], done: false }));
  return table.hashes().map((r) => ({ title: r.item, done: r.done === 'yes' }));
}

/** Two-column form table as ordered [field, value] pairs (rowsHash would lose duplicate order guarantees). */
export function formRows(table: DataTable): [string, string][] {
  return table.raw().map((r) => [r[0].trim(), r[1] ?? '']);
}

/**
 * Value a form cell stands for: `"   "` (double-quoted) is typed literally without the quotes, `<N characters>` is N
 * times `x`, anything else as is (empty = clear the field).
 */
export function cellValue(cell: string): string {
  const quoted = /^"(.*)"$/s.exec(cell);
  if (quoted) return quoted[1];
  const n = /^<(\d+) characters>$/.exec(cell.trim());
  if (n) return 'x'.repeat(Number(n[1]));
  return cell.trim();
}

/** "Milk, Eggs, Bread" -> list; "" -> []. */
export function splitList(s: string): string[] {
  return s === '' ? [] : s.split(', ');
}
