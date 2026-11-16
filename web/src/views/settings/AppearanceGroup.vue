<script setup lang="ts">
/** Settings group Appearance & layout (docs/settings-tree.md): theme, language, view switcher, bars, hands and hints. */
import { computed } from 'vue';
import type { BarSize, NavPhonePosition, NavPosition } from '@/api/types';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Switch from '@/components/m3/Switch.vue';
import MenuField from '@/components/m3/MenuField.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { LANGUAGE_NAMES, LANGUAGES, t, type LanguagePref } from '@/i18n';
import { NAV_POSITIONS } from '@/lib/navPosition';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { useThemeStore } from '@/stores/theme';
import { presetLabel, themeLabel as nameOfTheme } from '@/theme/labels';
import { automaticPreset } from '@/theme/presets';

const prefs = usePrefsStore();
const theme = useThemeStore();
const clock = useClockStore();
const savePrefs = useSavePrefs();

/** The chosen theme's name (an imported theme by its own name). */
const baseName = computed(() => (theme.pref.preset.startsWith('theme:') ? theme.themes.find((x) => `theme:${x.id}` === theme.pref.preset)?.doc.name ?? presetLabel('Default') : nameOfTheme(theme.pref.preset)));
/** The Theme row's value: the calendar's theme alone for Header + colours, "Neon · Halloween header" for Header only, else the name. */
const themeLabel = computed(() => {
  const today = presetLabel(automaticPreset(clock.today));
  return theme.pref.seasonal === 'all' ? today : theme.pref.seasonal === 'header' ? t('theme.seasonal.headerOf', { base: baseName.value, name: today }) : baseName.value;
});
/** Each language in its own name; Automatic follows the device language. */
const languageOptions = computed(() => [{ value: 'auto', label: t('settings.language.auto') }, ...LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))]);
const navOptions = (device: 'phone' | 'desktop') => (device === 'phone' ? [...NAV_POSITIONS, 'drawer' as const] : NAV_POSITIONS).map((p) => ({ value: p, label: t(`settings.navPosition.${p}`), testid: `settings-nav-${device}-${p}` }));
const barSizes = computed(() => (['auto', 'expressive', 'compact'] as const).map((v) => ({ value: v, label: v === 'auto' ? t('settingsNav.labels.barAuto') : t(`settings.calendar.barSize.${v}`), testid: `settings-bar-size-${v}` })));
/** The top bar's stored layout as a size choice (`two-rows` is Expressive, `one-row` Compact). */
const topBarSize = computed<BarSize>(() => (prefs.headerLayout === 'two-rows' ? 'expressive' : prefs.headerLayout === 'one-row' ? 'compact' : 'auto'));
const LAYOUT_OF = { auto: 'auto', expressive: 'two-rows', compact: 'one-row' } as const;
</script>

<template>
  <SettingSection>
    <SettingRow id="theme" to="/settings/theme" :label="t('settings.theme.label')" :hint="t('settings.theme.hint')" :value="themeLabel" testid="settings-theme" value-testid="settings-theme-name" />
    <SettingRow id="language" field :label="t('settings.language.label')">
      <MenuField :model-value="prefs.language" :options="languageOptions" :label="t('settings.language.label')" data-testid="settings-language" @update:model-value="savePrefs({ language: $event as LanguagePref })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.navigation')">
    <p class="note">{{ t('settings.navPosition.hint') }}</p>
    <SettingRow id="navPhone" field :label="t('settingsNav.labels.navPhone')">
      <MenuField :model-value="prefs.navPhone" :options="navOptions('phone')" :label="t('settingsNav.labels.navPhone')" data-testid="settings-nav-phone" @update:model-value="savePrefs({ navPhone: $event as NavPhonePosition })" />
    </SettingRow>
    <SettingRow id="navDesktop" field :label="t('settingsNav.labels.navDesktop')">
      <MenuField :model-value="prefs.navDesktop" :options="navOptions('desktop')" :label="t('settingsNav.labels.navDesktop')" data-testid="settings-nav-desktop" @update:model-value="savePrefs({ navDesktop: $event as NavPosition })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.bars')">
    <SettingRow id="topBarSize" wide :label="t('settings.calendar.topBarSize.label')" :hint="t('settings.calendar.topBarSize.hint')">
      <SegmentedButton :model-value="topBarSize" :options="barSizes" :label="t('settings.calendar.topBarSize.label')" data-testid="settings-top-bar-size" @update:model-value="savePrefs({ headerLayout: LAYOUT_OF[$event] })" />
    </SettingRow>
    <SettingRow id="bottomBarSize" wide :label="t('settings.calendar.bottomBarSize.label')" :hint="t('settings.calendar.bottomBarSize.hint')">
      <SegmentedButton :model-value="prefs.bottomBarSize" :options="barSizes" :label="t('settings.calendar.bottomBarSize.label')" data-testid="settings-bottom-bar-size" @update:model-value="savePrefs({ bottomBarSize: $event })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.more')">
    <SettingRow id="leftHanded" :label="t('settings.leftHanded.label')" :hint="t('settings.leftHanded.hint')">
      <Switch :model-value="prefs.leftHanded" :label="t('settings.leftHanded.label')" data-testid="settings-left-handed" @update:model-value="savePrefs({ leftHanded: $event })" />
    </SettingRow>
    <SettingRow id="syncIndicator" :label="t('settingsNav.labels.syncIndicator')" :hint="t('settings.calendar.syncIndicator.hint')">
      <Switch :model-value="prefs.syncIndicator" :label="t('settingsNav.labels.syncIndicator')" data-testid="settings-sync-indicator" @update:model-value="savePrefs({ syncIndicator: $event })" />
    </SettingRow>
    <SettingRow id="versionCorner" :label="t('settings.account.versionCorner.label')">
      <Switch :model-value="prefs.versionInCorner" :label="t('settings.account.versionCorner.label')" data-testid="settings-version-corner" @update:model-value="savePrefs({ versionInCorner: $event })" />
    </SettingRow>
  </SettingSection>

</template>
