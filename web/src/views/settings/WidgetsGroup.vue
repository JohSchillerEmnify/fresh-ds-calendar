<script setup lang="ts">
/** Settings group Widgets (docs/settings-tree.md): one section per platform (the iPhone widget, the Android home-screen widgets) and one for the Timeline's day count and text size both use. */
import { ref, watch } from 'vue';
import { timelineDays } from '@calendar/shared/prefs';
import type { AndroidWidgetHours, WidgetTimelineDays } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import Slider from '@/components/m3/Slider.vue';
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
const hourOptions = [8, 12, 16, 24].map((n) => ({ value: String(n), label: String(n), testid: `settings-widget-hours-${n}` }));
const liveSize = ref(prefs.widgetTimelineTextSize);
watch(() => prefs.widgetTimelineTextSize, (n) => { liveSize.value = n; });
const sizeText = (n: number) => `${n} %`;
const dayOptions = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n), testid: `settings-widget-days-${n}` }));
</script>

<template>
  <IphoneWidgetSection />

  <SettingSection :title="t('settingsNav.sub.android')">
    <SettingRow id="androidWidgets" wide :label="t('settings.widgets.android.label')" :hint="t('settings.widgets.android.hint')">
      <Button v-if="showApk" variant="tonal" data-testid="settings-android-widgets" @click="downloadApk">{{ t('settings.account.androidApp.download') }}</Button>
    </SettingRow>
    <SettingRow id="androidWidgetHours" wide :label="t('settings.widgets.scroll.label')" :hint="t('settings.widgets.scroll.hint')">
      <SegmentedButton connected :model-value="String(prefs.androidWidgetHours)" :options="hourOptions" :label="t('settings.widgets.scroll.label')" data-testid="settings-widget-hours" @update:model-value="savePrefs({ androidWidgetHours: Number($event) as AndroidWidgetHours })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.timeline')">
    <SettingRow id="widgetTimelineDays" wide :label="t('settings.widgets.scroll.days')" :hint="t('settings.widgets.timeline.hint')">
      <SegmentedButton connected :model-value="String(timelineDays(prefs))" :options="dayOptions" :label="t('settings.widgets.scroll.days')" data-testid="settings-widget-days" @update:model-value="savePrefs({ widgetTimelineDays: Number($event) as WidgetTimelineDays })" />
    </SettingRow>
    <SettingRow id="widgetTimelineTextSize" wide :label="t('settings.widgets.textSize.label')" :hint="t('settings.widgets.textSize.hint')">
      <Slider class="track" :model-value="liveSize" :min="90" :max="150" :step="5" :label="t('settings.widgets.textSize.label')" :value-text="sizeText(liveSize)" testid="settings-timeline-text-size" @update:model-value="liveSize = $event" @commit="savePrefs({ widgetTimelineTextSize: $event })" />
    </SettingRow>
  </SettingSection>
</template>

<style scoped>
.track { flex: 0 1 260px; }
/* the row already names the control; only the value stays in sight */
.track :deep(.lab) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.track :deep(.val) { grid-column: 2; }
</style>
