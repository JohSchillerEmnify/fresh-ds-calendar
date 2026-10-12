import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SnackbarMessage {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
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

  return { pickerOpen, filtersShown, trayExpanded, dialog, resizing, snackbars, openDialog, closeDialog, notify, dismiss };
});
