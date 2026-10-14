import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

export interface SnackbarMessage {
  id: number;
  text: string;
  action?: { label: string; run: () => void; testid?: string };
  /** ms; 0 = stays until dismissed. */
  duration: number;
  testid?: string;
  /** Test id of the ✕ button when it is not `<testid>-dismiss`. */
  dismissTestid?: string;
  /** Called when the person closes the snackbar with ✕ (not when the action is taken or the time runs out). */
  onClose?: () => void;
}

export interface OpenDialog {
  kind: string;
  /** Free-form props handed to the registered dialog component (see extensions/registry.ts). */
  props: Record<string, unknown>;
}

/** The timed entry whose resize handles are shown (set by releasing it without moving, ARCHITECTURE "Resize handles"). */
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

/** Shell UI state that must survive refreshes (open pickers, dialogs, snackbars). */
export const useUiStore = defineStore('ui', () => {
  const pickerOpen = ref(false);
  const filtersShown = ref(false);
  /** Phone open-tasks tray expanded; the FAB slides away meanwhile so it never covers the tray. */
  const trayExpanded = ref(false);
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
  /** Expands the card of that list and day, or collapses it when it already is; another expanded card collapses. */
  function toggleCard(card: ExpandedCard): void {
    const c = expandedCard.value;
    expandedCard.value = c && c.id === card.id && c.date === card.date ? null : { ...card };
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
  function dismiss(id: number): void {
    snackbars.value = snackbars.value.filter((s) => s.id !== id);
  }

  return { pickerOpen, filtersShown, trayExpanded, panelOpen, setPanel, dialog, resizing, expandedCard, snackbars, openDialog, closeDialog, toggleCard, collapseCard, notify, dismiss };
});
