/** Types of the validation limits in `limits.js`. */

/** A `HH:mm` wall-clock time. */
export declare const TIME_RE: RegExp;
/** Longest title, in characters: events, task lists, task items, template items and place names. */
export declare const TITLE_MAX: number;
/** Most items in one task list or template. */
export declare const LIST_ITEMS_MAX: number;
/** Allowed task list estimate, in whole minutes. */
export declare const ESTIMATE_MIN: number;
export declare const ESTIMATE_MAX: number;
/** Most ink one list holds, in bytes of {@link inkListBytes}. */
export declare const INK_LIST_MAX_BYTES: number;
/** The size the server counts for a list's ink: the JSON of the strokes of each of its ink items. */
export declare const inkListBytes: (perItem: unknown[]) => number;
