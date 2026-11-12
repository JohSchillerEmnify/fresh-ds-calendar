<script setup lang="ts">
/** Settings group Widgets (docs/settings-tree.md): one section per platform, the iPhone widget and the Android home-screen widgets. */
import Button from '@/components/m3/Button.vue';
import IphoneWidgetSection from '@/components/settings/IphoneWidgetSection.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { t } from '@/i18n';
import { downloadApk } from '@/native/app';
import { isIos } from '@/pwa/install';

// an iPhone cannot install the Android app, so only the explanation shows there
const showApk = !isIos();
</script>

<template>
  <IphoneWidgetSection />

  <SettingSection :title="t('settingsNav.sub.android')">
    <SettingRow id="androidWidgets" wide :label="t('settings.widgets.android.label')" :hint="t('settings.widgets.android.hint')">
      <Button v-if="showApk" variant="tonal" data-testid="settings-android-widgets" @click="downloadApk">{{ t('settings.account.androidApp.download') }}</Button>
    </SettingRow>
  </SettingSection>
</template>
