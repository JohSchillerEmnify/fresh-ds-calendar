/** "What's new" after an update (feature release-notes): one snackbar per device for notes it has not seen yet. */
import { watch } from 'vue';
import { api } from '@/api/client';
import type { ReleaseNote } from '@/api/types';
import { t } from '@/i18n';
import { runningVersion } from '@/pwa/update';
import { useUiStore } from '@/stores/ui';

const LAST_VERSION_KEY = 'cal.lastVersion';
const NOTES_SEEN_KEY = 'cal.notesSeen';
/** Longest note text shown in the snackbar before it is cut. */
const MAX_TEXT = 70;

/** Reads a per-device memory slot (null when storage is unavailable). */
function recall(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Writes a per-device memory slot; without storage the notes are simply offered again next start. */
function remember(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

/** The notes newer than the one the device has seen (`seenId` unknown or null: all of them); `notes` is newest first. */
export function unseenNotes(notes: ReleaseNote[], seenId: string | null): ReleaseNote[] {
  const at = seenId ? notes.findIndex((n) => n.id === seenId) : -1;
  return at < 0 ? notes : notes.slice(0, at);
}

/** Cuts a note to one snackbar line. */
function oneLine(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1).trimEnd()}…` : text;
}

/**
 * Tells once what is new when this device runs a different build than last time and there are unseen notes.
 * A device that never ran the app marks everything as seen and says nothing.
 */
export async function checkReleaseNotes(): Promise<void> {
  const version = runningVersion();
  const last = recall(LAST_VERSION_KEY);
  if (last === version) return;
  let notes: ReleaseNote[];
  try { notes = (await api.releaseNotes()).notes; } catch { return; } // offline: the next start asks again
  const newest = notes[0];
  const unseen = last === null ? [] : unseenNotes(notes, recall(NOTES_SEEN_KEY));
  if (!newest || !unseen.length) {
    if (newest) remember(NOTES_SEEN_KEY, newest.id);
    remember(LAST_VERSION_KEY, version);
    return;
  }
  const markSeen = () => { remember(NOTES_SEEN_KEY, newest.id); remember(LAST_VERSION_KEY, version); };
  const ui = useUiStore();
  const show = () => {
    const text = oneLine(unseen[0]!.text);
    ui.notify(unseen.length > 1 ? t('calendar.whatsNew.noteMore', { text, n: unseen.length - 1 }) : t('calendar.whatsNew.note', { text }), {
      duration: 0, testid: 'whats-new-note', dismissTestid: 'whats-new-dismiss',
      action: { label: t('calendar.whatsNew.open'), testid: 'whats-new-open', run: () => { markSeen(); ui.openDialog('whats-new'); } },
      onClose: markSeen,
    });
  };
  // one snackbar at a time and never over an open dialog: wait until both are clear (this also puts it after the update prompt)
  const clear = () => !ui.dialog && ui.snackbars.length === 0;
  if (clear()) { show(); return; }
  const stop = watch(clear, (ok) => { if (ok) { stop(); show(); } });
}
