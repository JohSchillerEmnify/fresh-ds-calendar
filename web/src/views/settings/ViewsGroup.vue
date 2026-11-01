<script setup lang="ts">
/** Settings group Views (docs/settings-tree.md): default view, month, week and day, and the Approaching card. */
import { computed, ref, watch } from 'vue';
import type { DaySideBySide, MinEventMinutes, MonthScroll, ViewName, WeekSideBySide } from '@/api/types';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Slider from '@/components/m3/Slider.vue';
import Switch from '@/components/m3/Switch.vue';
import RowSelect from '@/components/settings/RowSelect.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import { useSavePrefs, useSaveSettings } from '@/composables/useSaveSettings';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();
const prefs = usePrefsStore();
const save = useSaveSettings();
const savePrefs = useSavePrefs();

const views = computed(() => (['month', 'week', 'day'] as const).map((v) => ({ value: v, label: t(`views.${v}`) })));
const minEventOptions = computed(() => ([0, 15, 30] as const).map((n) => ({
  value: String(n), label: n ? t('settings.calendar.minEventLength.minutes', { n }) : t('settings.calendar.minEventLength.off'), testid: `settings-min-event-length-${n}`,
})));
const monthScrollOptions = computed(() => ([['sideways', 'sideways'], ['vertical', 'vertical'], ['vertical-snap', 'verticalSnap']] as const).map(([value, key]) => ({ value, label: t(`settings.calendar.monthScroll.${key}`) })));
/** "Up to N" options of the day or week "events side by side" setting. */
const sideBySide = (view: 'day' | 'week', ns: readonly number[]) => computed(() => ns.map((n) => ({
  value: String(n), label: t('settings.calendar.sideBySide.upTo', { n }), testid: `settings-${view}-side-by-side-${n}`,
})));
const dayOptions = sideBySide('day', [2, 3, 4]);
const weekOptions = sideBySide('week', [2, 3]);
/** The track length while the slider moves; saved when the move ends. */
const liveHours = ref(prefs.approachWindowHours);
watch(() => prefs.approachWindowHours, (h) => { liveHours.value = h; });
const hoursText = (h: number) => t('settingsNav.labels.trackHours', { count: h });
</script>

<template>
  <h2>{{ t('settingsNav.sub.general') }}</h2>
  <SettingRow id="defaultView" :label="t('settings.calendar.defaultView')">
    <RowSelect :model-value="settings.settings.defaultView" :options="views" :label="t('settings.calendar.defaultView')" data-testid="settings-default-view" @update:model-value="save({ defaultView: $event as ViewName })" />
  </SettingRow>
  <SettingRow id="minEventLength" wide :label="t('settings.calendar.minEventLength.label')" :hint="t('settings.calendar.minEventLength.hint')">
    <SegmentedButton :model-value="String(prefs.minEventMinutes)" :options="minEventOptions" :label="t('settings.calendar.minEventLength.label')" data-testid="settings-min-event-length" @update:model-value="savePrefs({ minEventMinutes: Number($event) as MinEventMinutes })" />
  </SettingRow>

  <h2>{{ t('settingsNav.sub.month') }}</h2>
  <SettingRow id="monthScroll" :label="t('settings.calendar.monthScroll.label')">
    <RowSelect :model-value="prefs.monthScroll" :options="monthScrollOptions" :label="t('settings.calendar.monthScroll.label')" data-testid="settings-month-scroll" @update:model-value="savePrefs({ monthScroll: $event as MonthScroll })" />
  </SettingRow>

  <h2>{{ t('settingsNav.sub.weekDay') }}</h2>
  <p class="note">{{ t('settings.calendar.sideBySide.hint') }}</p>
  <SettingRow id="daySideBySide" wide :label="t('settingsNav.labels.sideBySideDay')">
    <SegmentedButton :model-value="String(prefs.daySideBySide)" :options="dayOptions" :label="t('settingsNav.labels.sideBySideDay')" data-testid="settings-day-side-by-side" @update:model-value="savePrefs({ daySideBySide: Number($event) as DaySideBySide })" />
  </SettingRow>
  <SettingRow id="weekSideBySide" wide :label="t('settingsNav.labels.sideBySideWeek')">
    <SegmentedButton :model-value="String(prefs.weekSideBySide)" :options="weekOptions" :label="t('settingsNav.labels.sideBySideWeek')" data-testid="settings-week-side-by-side" @update:model-value="savePrefs({ weekSideBySide: Number($event) as WeekSideBySide })" />
  </SettingRow>

  <h2>{{ t('settingsNav.sub.approaching') }}</h2>
  <SettingRow id="approachingCard" :label="t('settings.calendar.approachingCard.label')" :hint="t('settings.calendar.approachingCard.hint')">
    <Switch :model-value="prefs.approachingCard" :label="t('settings.calendar.approachingCard.label')" data-testid="settings-approaching-card" @update:model-value="savePrefs({ approachingCard: $event })" />
  </SettingRow>
  <template v-if="prefs.approachingCard">
    <SettingRow id="approachTimeLeft" :label="t('settings.calendar.approachTimeLeft.label')" :hint="t('settings.calendar.approachTimeLeft.hint')">
      <Switch :model-value="prefs.approachTimeLeft" :label="t('settings.calendar.approachTimeLeft.label')" data-testid="settings-approach-time-left" @update:model-value="savePrefs({ approachTimeLeft: $event })" />
    </SettingRow>
    <SettingRow id="approachBar" :label="t('settings.calendar.approachBar.label')" :hint="t('settings.calendar.approachBar.hint')">
      <Switch :model-value="prefs.approachBar" :label="t('settings.calendar.approachBar.label')" data-testid="settings-approach-bar" @update:model-value="savePrefs({ approachBar: $event })" />
    </SettingRow>
    <SettingRow v-if="prefs.approachBar" id="approachWindow" wide :label="t('settings.calendar.approachWindow.label')" :hint="hoursText(liveHours)">
      <Slider class="track" :model-value="liveHours" :min="1" :max="24" :label="t('settings.calendar.approachWindow.label')" :value-text="hoursText(liveHours)" testid="settings-approach-window" @update:model-value="liveHours = $event" @commit="savePrefs({ approachWindowHours: $event })" />
    </SettingRow>
  </template>
</template>

<style scoped>
.track { flex: 0 1 260px; }
.track :deep(.lab), .track :deep(.val) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
