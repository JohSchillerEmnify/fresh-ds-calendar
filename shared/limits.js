/** Validation limits that the server enforces and the web forms mirror, so both sides cannot drift apart. */

/** A `HH:mm` wall-clock time. */
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** Longest title, in characters: events, task lists, task items, template items and place names. */
export const TITLE_MAX = 200;
/** Most items in one task list or template. */
export const LIST_ITEMS_MAX = 200;
/** Allowed task list estimate, in whole minutes. */
export const ESTIMATE_MIN = 5;
export const ESTIMATE_MAX = 720;
