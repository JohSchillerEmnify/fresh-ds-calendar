<script setup lang="ts">
/** Settings group Widgets (docs/settings-tree.md): one section per platform (the iPhone widget, the Android home-screen widgets) and one for the Timeline's day count and text size both use. */
import { computed, ref, watch } from 'vue';
import { timelineDays } from '@calendar/shared/prefs';
import type { AndroidWidgetHoursMode, WidgetTimelineDays } from '@/api/types';
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
const hourOptions = computed(() => (['auto', 'fixed'] as const).map((v) => ({ value: v, label: t(`settings.widgets.scroll.${v}`), testid: `settings-widget-hours-${v}` })));
const liveHours = ref(prefs.androidWidgetHours);
watch(() => prefs.androidWidgetHours, (n) => { liveHours.value = n; });
const hoursText = (n: number) => t('settings.widgets.scroll.hoursValue', { n });
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
      <div class="stack">
      <SegmentedButton connected :model-value="prefs.androidWidgetHoursMode" :options="hourOptions" :label="t('settings.widgets.scroll.label')" data-testid="settings-widget-hours" @update:model-value="savePrefs({ androidWidgetHoursMode: $event as AndroidWidgetHoursMode })" />
      <Slider v-if="prefs.androidWidgetHoursMode === 'fixed'" class="track" :model-value="liveHours" :min="4" :max="24" :step="1" :label="t('settings.widgets.scroll.label')" :value-text="hoursText(liveHours)" testid="settings-widget-hours-slider" @update:model-value="liveHours = $event" @commit="savePrefs({ androidWidgetHours: $event })" />
      </div>
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
/* the slider sits under the Automatic/Fixed choice, as in the mockup */
.stack { display: flex; flex-direction: column; align-items: stretch; gap: 8px; width: 100%; }
/* the row already names the control; only the value stays in sight */
.track :deep(.lab) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.track :deep(.val) { grid-column: 2; }
</style>
