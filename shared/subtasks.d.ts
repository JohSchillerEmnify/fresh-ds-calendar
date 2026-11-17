/** Types of the subtask rules in `subtasks.js`. */

/** Deepest level: 0 = task, 1 = subtask, 2 = sub-subtask. */
export declare const MAX_LEVEL: 2;
/** `{ level }` for a subtask level, nothing for a task: spread into an item. */
export declare const levelProp: (n: number | undefined) => { level?: 1 | 2 };
/** The item with level `n` (0 = a task: no `level`). */
export declare function withLevel<T extends object>(item: T, n: number): T;
/** The level of an item (a list that never had subtasks has no `level`). */
export declare const levelOf: (item: object) => number;
/** The same items with their levels made valid: the first is a task, every other is at most one level deeper than the one above and at most {@link MAX_LEVEL}. */
export declare function clampLevels<T extends object>(items: readonly T[]): T[];
/** The index after the item at `from` and all the subtasks that follow it. */
export declare function blockEnd(items: readonly object[], from: number): number;
/** The ids of the item `id` and its subtasks. */
export declare function blockIds(items: readonly { id: string }[], id: string): string[];
/** Lines of typed text with their level (a line is a subtask of the nearest line above it that is indented less; at most {@link MAX_LEVEL}); empty lines are dropped. */
export declare function parseIndented(text: string): { title: string; level: number }[];
/** Leading spaces of an item's line in the Google description: two per level. */
export declare const indentOf: (item: object) => string;
