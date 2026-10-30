import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { appTimeout, type Disposer } from '@/lib/timers';

export interface SnackbarMessage {
  id: number;
  text: string;
  action?: { label: string; run: () => void; testid?: string; /** The message stays after the action (the person dismisses it). */ keep?: boolean };
  /** ms; 0 = stays until dismissed. */
  duration: number;
  testid?: string;
  /** Test id of the ✕ button when it is not `<testid>-dismiss`. */
  dismissTestid?: string;
  /** Called when the person closes the snackbar with ✕ (not when the action is taken or the time runs out). */
  onClose?: () => void;
  /**
   * A countdown whose text changes every minute: screen readers hear it when it appears and can read it any time, but its
   * changes are not announced (hearing each minute would be noise).
   */
  countdown?: boolean;
}

export interface OpenDialog {
  kind: string;
  /** Free-form props handed to the registered dialog component (see extensions/registry.ts). */
  props: Record<string, unknown>;
}

/** The timed entry whose resize handles are shown (set by releasing it without moving, feature drag-to-reschedule). */
export interface ResizingEntry {
  kind: 'event' | 'tasklist';
  id: string;
  date: string;
}

/** The task list card that is expanded in place over the calendar (one at a time, never stored). */
export interface ExpandedCard {
  id: string;
  date: string;
}

let seq = 0;
const TRAY_COLLAPSED_KEY = 'cal.trayCollapsedDesktop';
/** How long a revealed tray row stays highlighted. */
const FLASH_MS = 1000;

/** Shell UI state that must survive refreshes (open pickers, dialogs, snackbars). */
export const useUiStore = defineStore('ui', () => {
  const pickerOpen = ref(false);
  const filtersShown = ref(false);
  /** Phone open-tasks tray expanded; the FAB slides away meanwhile so it never covers the tray. */
  const trayExpanded = ref(false);
  /** Desktop side tray collapsed to its slim edge strip (persisted in this browser; default open). The phone has `trayExpanded`. */
  const trayCollapsedDesktop = ref((() => { try { return localStorage.getItem(TRAY_COLLAPSED_KEY) === '1'; } catch { return false; } })());
  watch(trayCollapsedDesktop, (v) => { try { localStorage.setItem(TRAY_COLLAPSED_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ } });
  /** Ids of the lists the desktop tray shows right now; empty while it is collapsed, hidden or on a phone (published by `TaskTray`). */
  const trayListIds = ref<string[]>([]);
  /** The tray row that is briefly highlighted by `revealTask`. */
  const flashId = ref<string | null>(null);
  let flashStop: Disposer | null = null;
  /** Names of the bottom panels and sheets of a view that are open (the Canvas's area editor, the Tasks view's filter and sort sheets). */
  const panels = reactive(new Set<string>());
  /** Any of them is open: the phone's create button slides away like for the tray. */
  const panelOpen = computed(() => panels.size > 0);
  function setPanel(name: string, open: boolean): void {
    if (open) panels.add(name);
    else panels.delete(name);
  }
  const dialog = ref<OpenDialog | null>(null);
  const resizing = ref<ResizingEntry | null>(null);
  const expandedCard = ref<ExpandedCard | null>(null);
  const snackbars = ref<SnackbarMessage[]>([]);

  /** Opens a dialog registered with `registerDialog(kind, component)`. */
  function openDialog(kind: string, props: Record<string, unknown> = {}): void {
    dialog.value = { kind, props };
  }
  function closeDialog(): void {
    dialog.value = null;
  }
  /**
   * Opens a task list: when the open desktop tray already shows it, scrolls its row into view and flashes it instead of
   * stacking a second copy as the `tasklist-expanded` panel; otherwise (collapsed tray, phone, list not in the tray) opens that panel.
   */
  function revealTask(id: string): void {
    if (!trayListIds.value.includes(id)) { openDialog('tasklist-expanded', { id }); return; }
    flashStop?.();
    flashId.value = id;
    flashStop = appTimeout(() => { flashId.value = null; }, FLASH_MS);
  }
  /** Expands the card of that list and day (a set, never a toggle: a tap on a collapsed card always opens it); another expanded card collapses. */
  function expandCard(card: ExpandedCard): void {
    expandedCard.value = { ...card };
  }
  /** Collapses the expanded card; with `card` only when it is that one (a card going away must not close a newer one). */
  function collapseCard(card?: ExpandedCard): void {
    const c = expandedCard.value;
    if (!card || (c && c.id === card.id && c.date === card.date)) expandedCard.value = null;
  }

  function notify(text: string, opts: Partial<Omit<SnackbarMessage, 'id' | 'text'>> = {}): number {
    const id = ++seq;
    snackbars.value = [...snackbars.value.slice(-2), { id, text, duration: 4000, ...opts }];
    return id;
  }
  /** Changes the text of a snackbar that is still shown (a reminder counting down); unknown ids are ignored. */
  function update(id: number, text: string): void {
    if (snackbars.value.some((s) => s.id === id && s.text !== text)) snackbars.value = snackbars.value.map((s) => (s.id === id ? { ...s, text } : s));
  }
  function dismiss(id: number): void {
    snackbars.value = snackbars.value.filter((s) => s.id !== id);
  }

  return { pickerOpen, filtersShown, trayExpanded, trayCollapsedDesktop, trayListIds, flashId, revealTask, panelOpen, setPanel, dialog, resizing, expandedCard, snackbars, openDialog, closeDialog, expandCard, collapseCard, notify, update, dismiss };
});
