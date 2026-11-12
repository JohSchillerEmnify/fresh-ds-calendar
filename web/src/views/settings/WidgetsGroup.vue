<script setup lang="ts">
/** Settings group Widgets (docs/settings-tree.md): one section per platform (the iPhone widget, the Android home-screen widgets) and one for the Timeline's day count both use. */
import { computed } from 'vue';
import { timelineDays } from '@calendar/shared/prefs';
import type { AndroidWidgetStyle, WidgetTimelineDays } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import IphoneWidgetSection from '@/components/settings/IphoneWidgetSection.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { t } from '@/i18n';
import { downloadApk } from '@/native/app';
import { isIos } from '@/pwa/install';
import { usePrefsStore } from '@/stores/prefs';

// an iPhone cannot install the Android app, so only the explanation shows there
const showApk = !isIos();
const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
const styleOptions = computed(() => (['agenda', 'timeline'] as const).map((v) => ({ value: v, label: t(`settings.widgets.scroll.${v}`), testid: `settings-scrolling-style-${v}` })));
const dayOptions = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n), testid: `settings-widget-days-${n}` }));
</script>

<template>
  <IphoneWidgetSection />

  <SettingSection :title="t('settingsNav.sub.android')">
    <SettingRow id="androidWidgets" wide :label="t('settings.widgets.android.label')" :hint="t('settings.widgets.android.hint')">
      <Button v-if="showApk" variant="tonal" data-testid="settings-android-widgets" @click="downloadApk">{{ t('settings.account.androidApp.download') }}</Button>
    </SettingRow>
    <SettingRow id="androidWidgetStyle" wide :label="t('settings.widgets.scroll.label')" :hint="t('settings.widgets.scroll.hint')">
      <SegmentedButton connected :model-value="prefs.androidWidgetStyle" :options="styleOptions" :label="t('settings.widgets.scroll.label')" data-testid="settings-scrolling-style" @update:model-value="savePrefs({ androidWidgetStyle: $event as AndroidWidgetStyle })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.timeline')">
    <SettingRow id="widgetTimelineDays" wide :label="t('settings.widgets.scroll.days')" :hint="t('settings.widgets.timeline.hint')">
      <SegmentedButton connected :model-value="String(timelineDays(prefs))" :options="dayOptions" :label="t('settings.widgets.scroll.days')" data-testid="settings-widget-days" @update:model-value="savePrefs({ widgetTimelineDays: Number($event) as WidgetTimelineDays })" />
    </SettingRow>
  </SettingSection>
</template>
