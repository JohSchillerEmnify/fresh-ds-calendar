import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { api } from '@/api/client';
import {
  DEFAULT_PREF, resolveTheme, sanitizePref, seasonScene,
  type PresetName, type ThemeAttrs, type ThemePref,
} from '@/theme/presets';
import { useClockStore } from './clock';

const CACHE_KEY = 'cal.theme';
const ATTR_KEY = 'cal.themeAttrs';

function readCache(): ThemePref {
  try { return sanitizePref(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')); } catch { return { ...DEFAULT_PREF, overrides: {} }; }
}

/**
 * The person's chosen theme (preset + overrides), kept per person on the server (`/api/prefs/theme`) and cached in
 * localStorage. Picking applies at once (the attributes on `<html>` follow the resolved theme) and saves in the background.
 */
export const useThemeStore = defineStore('theme', () => {
  const clock = useClockStore();
  const pref = ref<ThemePref>(readCache());
  const saveError = ref<string | null>(null);
  /** The preset (Automatic resolved by today's date) with the overrides applied. */
  const resolved = computed(() => resolveTheme(pref.value, clock.today));
  /** The scene that stands for "the season" today. */
  const todaysSeasonScene = computed(() => seasonScene(clock.today));

  function remember(): void {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(pref.value)); } catch { /* storage unavailable */ }
  }

  async function load(signal?: AbortSignal): Promise<void> {
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
  const choose = (preset: PresetName) => save({ preset, overrides: {} });
  /** Fine-tunes one attribute on top of the chosen preset. */
  const pick = <K extends keyof ThemeAttrs>(setting: K, value: ThemeAttrs[K]) =>
    save({ preset: pref.value.preset, overrides: { ...pref.value.overrides, [setting]: value } });

  /** Mirrors the resolved theme onto `<html>` (attributes read by theme.css and the shell). */
  function applyAttrs(root: HTMLElement = document.documentElement): void {
    const r = resolved.value;
    root.setAttribute('data-theme-name', r.name);
    root.setAttribute('data-glow', r.attrs.glow);
    root.setAttribute('data-entries', r.attrs.entries);
    root.setAttribute('data-corners', r.attrs.corners);
    root.setAttribute('data-scene', r.attrs.scene);
    try { localStorage.setItem(ATTR_KEY, JSON.stringify({ name: r.name, ...r.attrs })); } catch { /* storage unavailable */ }
  }

  /** Wires the store to the DOM; call once before mount. Returns the stop function. */
  function install(): () => void {
    return watch(resolved, () => applyAttrs(), { immediate: true });
  }

  return { pref, resolved, todaysSeasonScene, saveError, load, choose, pick, install };
});
