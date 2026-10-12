import { reactive } from 'vue';

/** Per-list collapsed state of the overview cards (title row only), persisted in localStorage. `all` is the default for lists without an own choice. */
const KEY = 'tl-collapsed';
export interface CollapseState { all: boolean; ids: Record<string, boolean> }

export function loadCollapseState(): CollapseState {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CollapseState> | null;
    if (j && typeof j === 'object') return { all: j.all === true, ids: j.ids && typeof j.ids === 'object' ? { ...j.ids } : {} };
  } catch { /* storage unavailable or corrupt: defaults */ }
  return { all: false, ids: {} };
}

export const collapse = reactive<CollapseState>(loadCollapseState());
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ all: collapse.all, ids: collapse.ids })); } catch { /* ignore */ }
}
export const isCollapsed = (id: string): boolean => collapse.ids[id] ?? collapse.all;
export function toggleCollapsed(id: string): void {
  collapse.ids[id] = !isCollapsed(id);
  save();
}
/** Collapse or expand every list (clears the individual choices). */
export function setAllCollapsed(v: boolean): void {
  collapse.all = v;
  collapse.ids = {};
  save();
}
