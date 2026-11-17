/** The rules of subtasks (feature tasklist-subtasks): the level of an item, which items go with a task, indented text. */

/** Deepest level: 0 = task, 1 = subtask, 2 = sub-subtask. */
export const MAX_LEVEL = 2;

/** `{ level }` for a subtask level, nothing for a task: spread into an item. */
export const levelProp = (n) => (n === 1 || n === 2 ? { level: n } : {});

/** The item with level `n` (0 = a task: no `level`). */
export function withLevel(item, n) {
  const copy = { ...item };
  delete copy.level;
  return { ...copy, ...levelProp(n) };
}

/** The level of an item (a list that never had subtasks has no `level`). */
export const levelOf = (item) => item.level ?? 0;

/** The items with valid levels: the first is a task, each is at most one deeper than the one above, and at most {@link MAX_LEVEL}. */
export function clampLevels(items) {
  let prev = -1;
  return items.map((item) => {
    const level = Math.max(0, Math.min(levelOf(item), prev + 1, MAX_LEVEL));
    prev = level;
    return level === levelOf(item) ? item : withLevel(item, level);
  });
}

/** The index after the item at `from` and all the subtasks that follow it (the block that moves, ticks and goes together). */
export function blockEnd(items, from) {
  const base = levelOf(items[from]);
  let end = from + 1;
  while (end < items.length && levelOf(items[end]) > base) end++;
  return end;
}

/** The ids of the item `id` and its subtasks. */
export function blockIds(items, id) {
  const from = items.findIndex((i) => i.id === id);
  return from < 0 ? [] : items.slice(from, blockEnd(items, from)).map((i) => i.id);
}

/** Typed lines with their level: the nearest line above that is indented less is the parent (one space is enough); empty lines go. */
export function parseIndented(text) {
  const out = [];
  const indents = [];
  for (const raw of text.split(/\r?\n/)) {
    const title = raw.trim();
    if (!title) continue;
    const indent = raw.length - raw.trimStart().length;
    while (indents.length && indents[indents.length - 1] >= indent) indents.pop();
    out.push({ title, level: Math.min(indents.length, MAX_LEVEL) });
    indents.push(indent);
  }
  return out;
}

/** Leading spaces of an item's line in the Google description: two per level. */
export const indentOf = (item) => '  '.repeat(levelOf(item));
