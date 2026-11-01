<script setup lang="ts">
/** Settings group Labs (docs/settings-tree.md): the Labs switch, then the unfinished views and tools it shows. */
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Switch from '@/components/m3/Switch.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { LABS_VIEWS, isLabsViewOn } from '@/features/labs';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';

const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
const weekSplitOptions = [
  { value: '4', label: '4 / 3', testid: 'settings-week-two-row-split-4' },
  { value: '3', label: '3 / 4', testid: 'settings-week-two-row-split-3' },
];
</script>

<template>
  <SettingRow id="labs" :label="t('settingsNav.labels.showLabs')" :hint="t('settingsNav.labels.showLabsHint')">
    <Switch :model-value="prefs.labs" :label="t('settingsNav.labels.showLabs')" data-testid="settings-labs" @update:model-value="savePrefs({ labs: $event })" />
  </SettingRow>
  <template v-if="prefs.labs">
    <h2>{{ t('settingsNav.sub.views') }}</h2>
    <SettingRow v-for="v in LABS_VIEWS" :id="`labsView-${v.id}`" :key="v.id" :label="t(v.labelKey)">
      <Switch :model-value="isLabsViewOn(v.id, prefs.labsViews)" :label="t(v.labelKey)" :data-testid="`settings-labs-view-${v.id}`" @update:model-value="savePrefs({ labsViews: { [v.id]: $event } })" />
    </SettingRow>
    <h2>{{ t('settingsNav.sub.more') }}</h2>
    <SettingRow id="weekTwoRow" :label="t('settings.labs.weekTwoRow.label')" :hint="t('settings.labs.weekTwoRow.hint')">
      <Switch :model-value="prefs.weekTwoRow" :label="t('settings.labs.weekTwoRow.label')" data-testid="settings-week-two-row" @update:model-value="savePrefs({ weekTwoRow: $event })" />
    </SettingRow>
    <SettingRow v-if="prefs.weekTwoRow" id="weekTwoRowSplit" wide :label="t('settings.labs.weekTwoRow.split')">
      <SegmentedButton :model-value="String(prefs.weekTwoRowTop)" :options="weekSplitOptions" :label="t('settings.labs.weekTwoRow.split')" data-testid="settings-week-two-row-split" @update:model-value="savePrefs({ weekTwoRowTop: $event === '3' ? 3 : 4 })" />
    </SettingRow>
    <SettingRow id="handwriting" :label="t('ink.settings.label')" :hint="t('ink.settings.hint')">
      <Switch :model-value="prefs.labsHandwriting" :label="t('ink.settings.label')" data-testid="settings-labs-handwriting" @update:model-value="savePrefs({ labsHandwriting: $event })" />
    </SettingRow>
    <SettingRow id="ownThemes" :label="t('settings.ownThemes.label')" :hint="t('settings.ownThemes.hint')">
      <Switch :model-value="prefs.labsOwnThemes" :label="t('settings.ownThemes.label')" data-testid="settings-labs-own-themes" @update:model-value="savePrefs({ labsOwnThemes: $event })" />
    </SettingRow>
  </template>
</template>
