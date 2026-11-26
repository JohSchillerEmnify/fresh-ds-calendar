<script setup lang="ts">
/** Settings group Labs (docs/settings-tree.md): the Labs switch, then the unfinished views and tools it shows. */
import Switch from '@/components/m3/Switch.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { LABS_VIEWS, isLabsViewOn } from '@/features/labs';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';

const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
</script>

<template>
  <SettingSection>
    <SettingRow id="labs" :label="t('settingsNav.labels.showLabs')" :hint="t('settingsNav.labels.showLabsHint')">
      <Switch :model-value="prefs.labs" :label="t('settingsNav.labels.showLabs')" data-testid="settings-labs" @update:model-value="savePrefs({ labs: $event })" />
    </SettingRow>
  </SettingSection>
  <template v-if="prefs.labs">
    <SettingSection :title="t('settingsNav.sub.views')">
    <SettingRow v-for="v in LABS_VIEWS.filter((l) => !l.stable)" :id="`labsView-${v.id}`" :key="v.id" :label="t(v.labelKey)">
      <Switch :model-value="isLabsViewOn(v.id, prefs.labsViews)" :label="t(v.labelKey)" :data-testid="`settings-labs-view-${v.id}`" @update:model-value="savePrefs({ labsViews: { [v.id]: $event } })" />
    </SettingRow>
    </SettingSection>
    <SettingSection :title="t('settingsNav.sub.more')">
    <SettingRow id="handwriting" :label="t('ink.settings.label')" :hint="t('ink.settings.hint')">
      <Switch :model-value="prefs.labsHandwriting" :label="t('ink.settings.label')" data-testid="settings-labs-handwriting" @update:model-value="savePrefs({ labsHandwriting: $event })" />
    </SettingRow>
    <SettingRow id="ownThemes" :label="t('settings.ownThemes.label')" :hint="t('settings.ownThemes.hint')">
      <Switch :model-value="prefs.labsOwnThemes" :label="t('settings.ownThemes.label')" data-testid="settings-labs-own-themes" @update:model-value="savePrefs({ labsOwnThemes: $event })" />
    </SettingRow>
    </SettingSection>
  </template>
</template>
