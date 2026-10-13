/**
 * Which task list cards are collapsed (ARCHITECTURE "Task list view"): per list and per device, kept in `localStorage`
 * as a map of list id to `true`. Every storage access is guarded, so a blocked storage only means the state lasts for
 * this visit. Shared by every `TaskListView` and the Tasks view's "Collapse all" toggle.
 */
import { reactive } from 'vue';

export const COLLAPSED_KEY = 'cal.tasklistCollapsed';

/** The stored map, or an empty one when nothing usable is stored or the storage is blocked. */
function read(): Record<string, true> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] === true).map((k) => [k, true as const]));
  } catch {
    return {};
  }
}

const state = reactive<Record<string, true>>(read());

function write(): void {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state)); } catch { /* storage unavailable: lasts for this visit */ }
}

/** True when the list's card is collapsed. */
export const isCollapsed = (id: string): boolean => state[id] === true;

/** Collapses or expands one list's card and remembers it. */
export function setCollapsed(id: string, collapsed: boolean): void {
  if (collapsed) state[id] = true;
  else delete state[id];
  write();
}

/** Collapses or expands the cards of all the given lists with one write. */
export function setAllCollapsed(ids: string[], collapsed: boolean): void {
  for (const id of ids) {
    if (collapsed) state[id] = true;
    else delete state[id];
  }
  write();
}

/** Test hook: forgets the in-memory state and reloads it from the storage. */
export function reloadCollapsed(): void {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, read());
}
