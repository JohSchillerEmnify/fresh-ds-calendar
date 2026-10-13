import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ThemeDoc, ThemePicture } from '@calendar/shared';
import { api, type StoredTheme } from '@/api/client';
import {
  DEFAULT_PREF, resolveTheme, sanitizePref, seasonScene,
  type CustomThemeKey, type ThemeOverrides, type ThemePref,
} from '@/theme/presets';
import { useClockStore } from './clock';

const CACHE_KEY = 'cal.theme';

function readCache(): ThemePref {
  try { return sanitizePref(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')); } catch { return { ...DEFAULT_PREF, overrides: {} }; }
}

/**
 * The person's chosen theme (preset or imported theme, plus overrides), kept per person on the server
 * (`/api/prefs/theme`) and cached in localStorage, and their imported themes (`/api/themes`). Picking applies at once
 * (`<html>` follows the resolved theme, see `applyTheme`) and saves in the background.
 */
export const useThemeStore = defineStore('theme', () => {
  const clock = useClockStore();
  const pref = ref<ThemePref>(readCache());
  const saveError = ref<string | null>(null);
  const custom = ref<StoredTheme[]>([]);
  /** Imported themes whose delete is waiting for its undo time (hidden meanwhile). */
  const hidden = ref<string[]>([]);
  /** The person's imported themes as the gallery shows them. */
  const themes = computed(() => custom.value.filter((t) => !hidden.value.includes(t.id)));
  /** The chosen theme (Automatic resolved by today's date) with the overrides applied. */
  const resolved = computed(() => resolveTheme(pref.value, clock.today, Object.fromEntries(themes.value.map((t) => [t.id, t]))));
  /** The scene that stands for "the season" today. */
  const todaysSeasonScene = computed(() => seasonScene(clock.today));

  function remember(): void {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(pref.value)); } catch { /* storage unavailable */ }
  }

  async function load(signal?: AbortSignal): Promise<void> {
    // imported themes first, so a chosen one resolves as soon as the choice is known; without them it falls back to Default
    custom.value = await api.themes({ signal }).then((r) => r.themes, () => custom.value);
    pref.value = sanitizePref(await api.themePref({ signal }));
    remember();
  }

  /** Optimistic: apply now, save in the background. */
  async function save(next: ThemePref): Promise<void> {
    pref.value = next;
    remember();
    saveError.value = null;
    try {
      await api.patchThemePref(next);
    } catch {
      saveError.value = 'Could not save the theme';
    }
  }

  /** Chooses a preset; its own look replaces earlier fine-tuning. */
  const choose = (preset: ThemePref['preset']) => save({ preset, overrides: {} });
  /** Fine-tunes one attribute or the seed colour on top of the chosen theme. */
  const pick = <K extends keyof ThemeOverrides>(setting: K, value: NonNullable<ThemeOverrides[K]>) =>
    save({ preset: pref.value.preset, overrides: { ...pref.value.overrides, [setting]: value } });

  /** Saves a validated document (and its own picture) as one of the person's themes and chooses it. */
  async function importTheme(doc: ThemeDoc, picture?: ThemePicture): Promise<void> {
    const saved = await api.saveTheme(doc, picture);
    custom.value = [...custom.value, { id: saved.id, doc: saved.doc, picture: saved.picture }];
    await choose(`theme:${saved.id}` as CustomThemeKey);
  }
  const hide = (id: string) => { hidden.value = [...hidden.value, id]; };
  const unhide = (id: string) => { hidden.value = hidden.value.filter((x) => x !== id); };
  /** Deletes on the server (after the undo time); the theme is gone from the list for good. */
  async function removeCustom(id: string, keepalive = false): Promise<void> {
    await api.deleteTheme(id, { keepalive });
    custom.value = custom.value.filter((t) => t.id !== id);
    unhide(id);
  }

  return { pref, resolved, themes, todaysSeasonScene, saveError, load, choose, pick, importTheme, hide, unhide, removeCustom };
});
