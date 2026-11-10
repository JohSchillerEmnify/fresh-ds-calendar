/** The task list cards grown in place over the calendar (several at once, remembered on this device only, never synced). */
import { reactive, ref } from 'vue';
import { StorageSerializers, useStorage } from '@vueuse/core';

/** A task list card that is expanded in place over the calendar (several may be, remembered on this device only). */
export interface ExpandedCard {
  id: string;
  date: string;
}


export const EXPANDED_CARD_KEY = 'cal.expandedCards';
/** The single-card key of earlier versions; read once into the list, then removed. */
const OLD_EXPANDED_CARD_KEY = 'cal.expandedCard';
const cardKey = (c: ExpandedCard): string => `${c.id}|${c.date}`;
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

/** The grown cards and what belongs to them, shared by the `ui` store. */
export function useExpandedCards() {
  /** Kept in this browser's storage (not synced), so the expansion survives view changes, reloads and reopening the app; other tabs keep their own. */
  const expandedCards = useStorage<ExpandedCard[]>(EXPANDED_CARD_KEY, [], undefined, { serializer: StorageSerializers.object, listenToStorageChanges: false });
  migrateOldExpandedCard(expandedCards);
  /** The card instance showing each expansion, by list and day (a view may hold the same list twice; only one grows). Never stored. */
  const expandedOwners = reactive(new Map<string, number>());
  /** The grown card tapped last: it is drawn above grown cards that overlap it. */
  const frontCard = ref<string | null>(null);
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
  return { expandedCards, ownerOf, claimCard, renameCard, bringToFront, isFront, expandCard, collapseCard, releaseCard };
}
