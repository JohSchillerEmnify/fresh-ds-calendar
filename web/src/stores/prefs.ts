import { logUndone } from '@/lib/decisionLog';
import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { defaultPrefs, mergePref, PREFS, PREF_KEYS } from '@calendar/shared/prefs';
import { api } from '@/api/client';
import { useDeviceStore } from './device';
import { cachedLanguagePref } from '@/i18n';
import type { Prefs } from '@/api/types';

/** Per-person preferences (`GET/PATCH /api/prefs`): names, defaults and merge rules come from `shared/prefs.js`; the language starts from the device's cache. */
export const usePrefsStore = defineStore('prefs', () => {
  const defaults = { ...defaultPrefs(), language: cachedLanguagePref() };
  const prefs = Object.fromEntries(PREF_KEYS.map((k) => [k, ref(defaults[k])])) as { [K in keyof Prefs]: Ref<Prefs[K]> };
  /** The server's answer has been applied once (the top bar's `data-ready`: a hidden streak is then a choice, not a wait). */
  const loaded = ref(false);

  function apply(p: Partial<Prefs>): void {
    for (const k of PREF_KEYS) {
      if (p[k] == null) continue;
      // a value this client does not know (a newer server) keeps the current one instead of breaking the app
      if (!('value' in PREFS[k].parse(p[k], k))) continue;
      (prefs[k] as Ref<unknown>).value = mergePref(k, prefs[k].value, p[k]);
    }
  }

  /** Every preference as it is now (the rollback copy of `set`, and what the last known state keeps). */
  function current(): Prefs {
    return Object.fromEntries(PREF_KEYS.map((k) => [k, prefs[k].value])) as unknown as Prefs;
  }

  /** Takes the preferences the device holds (every sync). */
  function fromDevice(p: Partial<Prefs>): void {
    apply(p);
    loaded.value = true;
  }

  /** Reads the preferences from the device store; the server only before the device has had its first sync. */
  async function load(): Promise<void> {
    try {
      apply(useDeviceStore().file<Prefs>('prefs') ?? await api.prefs());
      loaded.value = true;
    } catch { /* offline or signed out: switches keep their defaults */ }
  }

  /** Optimistic change; rolls back when the server refuses. */
  async function set(p: Partial<Prefs>): Promise<void> {
    const before = current();
    apply(p);
    try {
      const saved = await api.patchPrefs(p);
      useDeviceStore().putFile('prefs', saved ?? current());
    } catch (e) {
      logUndone('preference', e);
      apply(before);
      throw e;
    }
  }

  return { ...prefs, loaded, load, set, current, fromDevice };
});
