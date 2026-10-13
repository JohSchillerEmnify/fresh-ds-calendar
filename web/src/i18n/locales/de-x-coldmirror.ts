/**
 * Coldmirror slang. Partial and deliberately small: whatever is missing falls back to `de`, then `en`.
 * Never "Ich bin voll geil" (owner).
 */
import type { PartialMessages } from './en';

export const deXColdmirror: PartialMessages = {
  errors: {
    saveUnavailable: 'Schinken! Google Kalender ist gerade nicht da.',
    conflict: 'Was ist das für 1 Termin? Der wurde woanders geändert, du Oberpflaume. Lad ihn neu.',
    validation: {
      endAfterStart: 'Das Ende vor dem Anfang? Du Oberpflaume.',
    },
  },
  tasklist: {
    untitled: 'Liste',
    titleOrItem: 'Schinken! Gib einen Titel oder einen Eintrag ein',
  },
  settings: {
    saveFailed: 'BÄMbus! Nee, doch nicht: gespeichert wurde nix.',
    language: { label: 'Sprache, du Oberpflaume' },
    motivation: {
      supportCat: 'Trostkatze (Eulen. Eulen everywhere.)',
    },
    account: {
      resetDemo: { done: 'BÄMbus! Die Demodaten sind wieder da.' },
    },
  },
};
