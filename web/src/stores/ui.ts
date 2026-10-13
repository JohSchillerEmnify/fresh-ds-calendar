import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

export interface SnackbarMessage {
  id: number;
  text: string;
  action?: { label: string; run: () => void; testid?: string };
  /** ms; 0 = stays until dismissed. */
  duration: number;
  testid?: string;
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
  const snackbars = ref<SnackbarMessage[]>([]);

  /** Opens a dialog registered with `registerDialog(kind, component)`. */
  function openDialog(kind: string, props: Record<string, unknown> = {}): void {
    dialog.value = { kind, props };
  }
  function closeDialog(): void {
    dialog.value = null;
  }

  function notify(text: string, opts: Partial<Omit<SnackbarMessage, 'id' | 'text'>> = {}): number {
    const id = ++seq;
    snackbars.value = [...snackbars.value.slice(-2), { id, text, duration: 4000, ...opts }];
    return id;
  }
  function dismiss(id: number): void {
    snackbars.value = snackbars.value.filter((s) => s.id !== id);
  }

  return { pickerOpen, filtersShown, trayExpanded, panelOpen, setPanel, dialog, resizing, snackbars, openDialog, closeDialog, notify, dismiss };
});
