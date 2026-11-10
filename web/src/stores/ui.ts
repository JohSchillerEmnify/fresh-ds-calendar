import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { StorageSerializers, useStorage } from '@vueuse/core';
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

/** A task list card that is expanded in place over the calendar (several may be, remembered on this device only). */
export interface ExpandedCard {
  id: string;
  date: string;
}

let seq = 0;
let ownerSeq = 0;
/** A fresh id for a card instance that may show the expansion (`expandCard`'s `owner`). */
export const nextCardOwner = (): number => ++ownerSeq;
const TRAY_COLLAPSED_KEY = 'cal.trayCollapsedDesktop';
export const EXPANDED_CARD_KEY = 'cal.expandedCards';
/** The single-card key of earlier versions; read once into the list, then removed. */
const OLD_EXPANDED_CARD_KEY = 'cal.expandedCard';
const cardKey = (c: ExpandedCard): string => `${c.id}|${c.date}`;
/** How long a revealed tray row stays highlighted. */
const FLASH_MS = 1000;

/** Moves a card grown by an earlier version (one stored object) into the list, once. */
function migrateOldExpandedCard(list: { value: ExpandedCard[] }): void {
  try {
    const old = localStorage.getItem(OLD_EXPANDED_CARD_KEY);
    if (old === null) return;
    localStorage.removeItem(OLD_EXPANDED_CARD_KEY);
    const c = JSON.parse(old) as ExpandedCard | null;
    if (c && typeof c.id === 'string' && typeof c.date === 'string' && !list.value.some((x) => cardKey(x) === cardKey(c))) list.value = [...list.value, c];
  } catch { /* storage unavailable or unreadable: nothing to carry over */ }
}

/** Shell UI state that must survive refreshes (open pickers, dialogs, snackbars). */
export const useUiStore = defineStore('ui', () => {
  const pickerOpen = ref(false);
  const filtersShown = ref(false);
  /** The side menu (view switcher position "Side menu") is open. */
  const sideMenuOpen = ref(false);
  /** Phone open-tasks tray expanded; the FAB slides away meanwhile so it never covers the tray. */
  const trayExpanded = ref(false);
  /** Desktop side tray collapsed to its slim edge strip (persisted in this browser; default open). The phone has `trayExpanded`. */
  const trayCollapsedDesktop = useStorage(TRAY_COLLAPSED_KEY, false, undefined, {
    listenToStorageChanges: false, writeDefaults: false, flush: 'sync', onError: () => {}, serializer: { read: (v) => v === '1', write: (v) => (v ? '1' : '0') },
  });
  /** Ids of the lists the desktop tray shows right now; empty while it is collapsed, hidden or on a phone (published by `TaskTray`). */
  const trayListIds = ref<string[]>([]);
  /** The tray row that is briefly highlighted by `revealTask`. */
  const flashId = ref<string | null>(null);
  let flashStop: Disposer | null = null;
  /** Names of the bottom panels and sheets of a view that are open (the Canvas's area editor, the Tasks view's filter and sort sheets). */
  const panels = reactive(new Set<string>());
  /** Any of them is open: the phone's create button slides away like for the tray. */
  /** The bottom bar is slid away (scrolling down); the Tasks view's floating toolbar goes with it (published by `App`). */
  const barHidden = ref(false);
  const panelOpen = computed(() => panels.size > 0);
  function setPanel(name: string, open: boolean): void {
    if (open) panels.add(name);
    else panels.delete(name);
  }
  const dialog = ref<OpenDialog | null>(null);
  const resizing = ref<ResizingEntry | null>(null);
  /** Kept in this browser's storage (not synced), so the expansion survives view changes, reloads and reopening the app; other tabs keep their own. */
  const expandedCards = useStorage<ExpandedCard[]>(EXPANDED_CARD_KEY, [], undefined, { serializer: StorageSerializers.object, listenToStorageChanges: false });
  migrateOldExpandedCard(expandedCards);
  /** The card instance showing each expansion, by list and day (a view may hold the same list twice; only one grows). Never stored. */
  const expandedOwners = reactive(new Map<string, number>());
  /** The grown card tapped last: it is drawn above grown cards that overlap it. */
  const frontCard = ref<string | null>(null);
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
  /** Expands the card of that list and day, shown by the card instance `owner` (a set, never a toggle). With `several` off every other grown card collapses. */
  function expandCard(card: ExpandedCard, owner: number | null = null, several = true): void {
    const k = cardKey(card);
    if (!several) for (const o of [...expandedCards.value]) if (cardKey(o) !== k) collapseCard(o);
    if (!expandedCards.value.some((c) => cardKey(c) === k)) expandedCards.value = [...expandedCards.value, { ...card }];
    if (owner === null) expandedOwners.delete(k);
    else expandedOwners.set(k, owner);
  }
  /** Collapses and forgets that card (all of them without `card`). */
  function collapseCard(card?: ExpandedCard): void {
    if (!card) { expandedCards.value = []; expandedOwners.clear(); frontCard.value = null; return; }
    const k = cardKey(card);
    expandedCards.value = expandedCards.value.filter((c) => cardKey(c) !== k);
    expandedOwners.delete(k);
    if (frontCard.value === k) frontCard.value = null;
  }
  /** The card instance that shows this expansion, if any. */
  function ownerOf(card: ExpandedCard): number | undefined {
    return expandedOwners.get(cardKey(card));
  }
  /** A card instance takes over a remembered expansion nobody shows yet. */
  function claimCard(card: ExpandedCard, owner: number): void {
    expandedOwners.set(cardKey(card), owner);
  }
  /** A card instance going away stops showing its expansions but keeps them remembered for the next card of that list. */
  function releaseCard(owner: number): void {
    for (const [k, o] of expandedOwners) if (o === owner) expandedOwners.delete(k);
  }
  /** A list's device id was replaced by the server's: its grown cards keep their place. */
  function renameCard(from: string, to: string): void {
    expandedCards.value = expandedCards.value.map((c) => {
      if (c.id !== from) return c;
      const next = { ...c, id: to };
      const o = expandedOwners.get(cardKey(c));
      expandedOwners.delete(cardKey(c));
      if (o !== undefined) expandedOwners.set(cardKey(next), o);
      if (frontCard.value === cardKey(c)) frontCard.value = cardKey(next);
      return next;
    });
  }
  /** Draws that grown card above the ones it overlaps. */
  function bringToFront(card: ExpandedCard): void {
    frontCard.value = cardKey(card);
  }
  /** Whether that grown card is the one drawn on top. */
  function isFront(card: ExpandedCard): boolean {
    return frontCard.value === cardKey(card);
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

  return { pickerOpen, filtersShown, sideMenuOpen, trayExpanded, trayCollapsedDesktop, trayListIds, flashId, revealTask, panelOpen, barHidden, setPanel, dialog, resizing, expandedCards, ownerOf, claimCard, renameCard, bringToFront, isFront, snackbars, openDialog, closeDialog, expandCard, collapseCard, releaseCard, notify, update, dismiss };
});
