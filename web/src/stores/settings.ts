import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { api, ApiError } from '@/api/client';
import type { Category, Settings, SettingsPatch } from '@/api/types';
import { MORDOR_SEED } from '@/api/colors';
import { applySeed, applyThemeMode, DEFAULT_SEED } from '@/theme';
import { DisposerBag, listen } from '@/lib/timers';
import type { SceneName as ShownScene } from '@/features/motivation/types';
import { usePrefsStore } from './prefs';
import { useThemeStore } from './theme';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'shopping', name: 'Shopping', color: '#0b8043', icon: '🛒', googleColorId: '10' },
  { id: 'todo', name: 'To-do', color: '#3f51b5', icon: '✅', googleColorId: '9' },
  { id: 'work', name: 'Work', color: '#8e24aa', icon: '💼', googleColorId: '3' },
  { id: 'home', name: 'Home', color: '#f4511e', icon: '🏠', googleColorId: '6' },
];

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system', seedColor: DEFAULT_SEED, defaultView: 'month', defaultEventColorId: null,
  animationLevel: 'full', sounds: false, calmMode: false, ignoreSystemMotion: false, transitionWarningMinutes: 10,
  streakFlame: true, garden: 'plant', categories: DEFAULT_CATEGORIES,
  updated: '', version: 0,
};

/** Settings + categories (API.md). Optimistic patches with `If-Match: <version>`; 412 re-reads and retries once. */
export const useSettingsStore = defineStore('settings', () => {
  const s = ref<Settings>({ ...DEFAULT_SETTINGS });
  const loaded = ref(false);
  const saveError = ref<string | null>(null);

  const categories = computed(() => s.value.categories);
  const categoryById = (id: string | null | undefined) => categories.value.find((c) => c.id === id);
  /**
   * Scene the top bar actually shows (API.md "Scenes"): the theme's scene, where sunflowers only show with garden
   * 'sunflowers'; every other scene shows regardless of garden, none = nothing.
   */
  const effectiveScene = computed<ShownScene>(() => {
    const themed = useThemeStore().resolved.attrs.scene;
    return themed === 'sunflowers' && s.value.garden !== 'sunflowers' ? 'none' : themed;
  });

  async function load(signal?: AbortSignal): Promise<void> {
    const next = await api.settings({ signal });
    // Skip churn when nothing changed (polling).
    if (next.version !== s.value.version || !loaded.value) s.value = next;
    loaded.value = true;
  }

  function mergeLocal(p: SettingsPatch): void {
    s.value = { ...s.value, ...p };
  }

  /** Optimistic update; rolls back and rethrows on failure (the caller / sync banner shows the error). */
  async function patch(p: SettingsPatch): Promise<void> {
    const before = s.value;
    saveError.value = null;
    mergeLocal(p);
    try {
      try {
        s.value = await api.patchSettings(p, { ifMatch: before.version });
      } catch (e) {
        if (!(e instanceof ApiError && e.isConflict)) throw e;
        const fresh = await api.settings();
        s.value = fresh;
        mergeLocal(p);
        const saved = await api.patchSettings(p, { ifMatch: fresh.version });
        s.value = saved;
      }
    } catch (e) {
      s.value = before;
      saveError.value = e instanceof ApiError ? e.userMessage : 'Could not save settings';
      throw e;
    }
  }

  /** Category mutations return the whole Settings. */
  async function categoryOp(fn: () => Promise<Settings>): Promise<Settings> {
    const next = await fn();
    s.value = next;
    return next;
  }
  const addCategory = (c: { name: string; color: string; icon?: string | null }) => categoryOp(() => api.createCategory(c));
  const updateCategory = (id: string, c: { name?: string; color?: string; icon?: string | null }) => categoryOp(() => api.updateCategory(id, c));
  const deleteCategory = (id: string) => categoryOp(() => api.deleteCategory(id));
  async function moveCategory(id: string, dir: -1 | 1): Promise<void> {
    const ids = categories.value.map((c) => c.id);
    const i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const before = s.value;
    s.value = { ...before, categories: ids.map((x) => before.categories.find((c) => c.id === x)!) };
    try {
      s.value = await api.reorderCategories(ids);
    } catch (e) {
      s.value = before;
      throw e;
    }
  }

  /** The "Mordor" shortcut: seed #c43e00 + dark mode (settings) + the Mordor scene (theme). */
  async function applyMordor(): Promise<void> {
    await patch({ seedColor: MORDOR_SEED, themeMode: 'dark' });
    await useThemeStore().pick('scene', 'mordor');
  }

  // --- DOM side effects ---------------------------------------------------------
  const bag = new DisposerBag();
  let stopWatch: (() => void) | null = null;

  function syncMeta() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface').trim();
    if (!v) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.removeAttribute('media');
      m.setAttribute('content', v);
    });
  }

  /** Wires settings → theme/DOM. Call once from main.ts; returns the stop function. */
  function installAppearance(): () => void {
    stopAppearance();
    const root = document.documentElement;
    const theme = useThemeStore();
    const stopTheme = theme.install();
    if (typeof matchMedia === 'function') {
      bag.add(listen(matchMedia('(prefers-color-scheme: dark)'), 'change', () => { applyThemeMode(theme.resolved.mode ?? s.value.themeMode); syncMeta(); }));
    }
    stopWatch = watch(
      // a theme preset's seed/mode replace the person's own while it is chosen
      () => [theme.resolved.mode ?? s.value.themeMode, theme.resolved.seed ?? s.value.seedColor] as const,
      async ([mode, seed]) => {
        applyThemeMode(mode);
        await applySeed(seed);
        syncMeta();
      },
      { immediate: true },
    );
    // html[data-motion] is owned by src/motion/level.ts (useAnimationLevel in App.vue); calm styling flag here.
    const stop2 = watch(() => s.value.calmMode, () => {
      if (s.value.calmMode) root.dataset.calm = 'true';
      else delete root.dataset.calm;
    }, { immediate: true });
    // html[data-hand="left"] mirrors the phone layout (left-handed mode, a person pref; CSS scopes it to the phone)
    const prefs = usePrefsStore();
    const stop3 = watch(() => prefs.leftHanded, (on) => {
      if (on) root.dataset.hand = 'left';
      else delete root.dataset.hand;
    }, { immediate: true });
    return () => { stop2(); stop3(); stopTheme(); stopAppearance(); };
  }
  function stopAppearance() {
    stopWatch?.();
    stopWatch = null;
    bag.dispose();
  }

  return {
    settings: s, loaded, saveError, categories, categoryById, effectiveScene,
    load, patch, addCategory, updateCategory, deleteCategory, moveCategory, applyMordor, installAppearance, stopAppearance,
  };
});
