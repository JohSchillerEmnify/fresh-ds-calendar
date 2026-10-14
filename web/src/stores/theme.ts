import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ThemeDoc, ThemePicture } from '@calendar/shared';
import { api, type StoredTheme } from '@/api/client';
import {
  DEFAULT_PREF, resolveTheme, sanitizePref,
  type CustomThemeKey, type Seasonal, type ThemeOverrides, type ThemePref,
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
  /** The chosen theme (the calendar's theme and scene applied per the seasons & holidays setting) with the overrides applied. */
  const resolved = computed(() => resolveTheme(pref.value, clock.today, Object.fromEntries(themes.value.map((t) => [t.id, t]))));

  function remember(): void {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(pref.value)); } catch { /* storage unavailable */ }
  }

  async function load(signal?: AbortSignal): Promise<void> {
    // both requests go out together (one round trip fewer before the first paint)
    const themes = api.themes({ signal }).then((r) => r.themes, () => custom.value);
    const choice = api.themePref({ signal });
    choice.catch(() => {}); // a refusal is rethrown below, after the themes were applied
    // imported themes first, so a chosen one resolves as soon as the choice is known; without them it falls back to Default
    custom.value = await themes;
    pref.value = sanitizePref(await choice);
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

  /**
   * Chooses a preset (an explicit pick): its own look replaces earlier fine-tuning, and Header + colours steps down to
   * Header only so the person's colours show while the header stays seasonal.
   */
  const choose = (preset: ThemePref['preset']) => save({ preset, overrides: {}, seasonal: pref.value.seasonal === 'all' ? 'header' : pref.value.seasonal });
  /** Fine-tunes one attribute or the seed colour on top of the chosen theme; picking a scene turns seasons off. */
  const pick = <K extends keyof ThemeOverrides>(setting: K, value: NonNullable<ThemeOverrides[K]>) =>
    save({ ...pref.value, overrides: { ...pref.value.overrides, [setting]: value }, seasonal: setting === 'scene' ? 'off' : pref.value.seasonal });
  /** Fine-tunes several values at once (a step and its slider value are one change, so one request). */
  const pickMany = (patch: ThemeOverrides) => save({ ...pref.value, overrides: { ...pref.value.overrides, ...patch } });
  /** Applies a fine-tuning change at once without saving it (a slider being dragged); the commit saves it. */
  function preview(patch: ThemeOverrides): void {
    pref.value = { ...pref.value, overrides: { ...pref.value.overrides, ...patch } };
    remember();
  }
  /** Sets what the calendar changes by itself; the seasons and holidays show again, so a picked scene is dropped. */
  const setSeasonal = (seasonal: Seasonal) => {
    const { scene: _scene, ...rest } = pref.value.overrides;
    return save({ ...pref.value, overrides: seasonal === 'off' ? pref.value.overrides : rest, seasonal });
  };

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

  return { pref, resolved, themes, saveError, load, choose, pick, pickMany, preview, setSeasonal, importTheme, hide, unhide, removeCustom };
});
