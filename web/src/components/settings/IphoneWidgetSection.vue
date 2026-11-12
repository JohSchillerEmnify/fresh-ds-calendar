<script setup lang="ts">
/** The iPhone widget section of Settings › Widgets (feature iphone-widget): the devices with a widget key, add and remove. */
import { computed, onMounted, ref } from 'vue';
import type { TimelineHours, WidgetCircle, WidgetKey, WidgetLayout } from '@/api/types';
import TextField from '@/components/m3/TextField.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Button from '@/components/m3/Button.vue';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import IphoneWidgetSheet from '@/components/settings/IphoneWidgetSheet.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { dateLocale, t } from '@/i18n';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { usePrefsStore } from '@/stores/prefs';
import { useWidgetKeys } from '@/composables/useWidgetKeys';
import { useBackupStore } from '@/stores/backup';
import { useClockStore } from '@/stores/clock';
import { useUiStore } from '@/stores/ui';

const { keys, loaded, load, refresh, remove: removeKey } = useWidgetKeys();
const clock = useClockStore();
const backup = useBackupStore();
const ui = useUiStore();
const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
const circleOptions = computed(() => (['time', 'countdown'] as const).map((v) => ({ value: v, label: t(`iphoneWidget.circle.${v}`), testid: `settings-widget-circle-${v}` })));
const layoutOptions = computed(() => (['standard', 'timeline'] as const).map((v) => ({ value: v, label: t(`iphoneWidget.layout.${v}`), testid: `settings-widget-layout-${v}` })));
const hoursOptions = computed(() => (['auto', 'fixed'] as const).map((v) => ({ value: v, label: t(`iphoneWidget.hours.${v}`), testid: `settings-widget-range-${v}` })));
const saveHours = (patch: Partial<TimelineHours>) => savePrefs({ widgetTimelineHours: patch as TimelineHours });
const adding = ref(false);
const removing = ref<WidgetKey | null>(null);

// the list shows at once from the device (last known state) and is read again here: the widget may have been used since
onMounted(() => { load().then(() => refresh()).catch(() => undefined); });

const usedText = (k: WidgetKey) => (k.lastUsedAt ? t('iphoneWidget.lastUsed', { time: backup.formatTime(k.lastUsedAt, clock.timeZone) }) : t('iphoneWidget.never'));
/** Year-month-day and hour:minute in the calendar's time zone, for tests and assistive tools. */
function usedLocal(k: WidgetKey): string {
  if (!k.lastUsedAt) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat(dateLocale(), { timeZone: clock.timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(k.lastUsedAt)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

async function remove() {
  const k = removing.value;
  removing.value = null;
  if (!k) return;
  try { await removeKey(k.id); } catch { ui.notify(t('iphoneWidget.failed')); }
}
</script>

<template>
  <SettingSection :title="t('settingsNav.sub.iphone')">
    <div data-testid="iphone-widget-keys">
      <SettingRow v-if="loaded && !keys.length" id="iphoneWidget" wide :label="t('iphoneWidget.intro')">
        <Button variant="tonal" data-testid="iphone-widget-add" @click="adding = true">{{ t('iphoneWidget.add') }}</Button>
      </SettingRow>
      <template v-else>
        <SettingRow v-for="k in keys" :id="`iphoneWidget-${k.id}`" :key="k.id" :label="k.name" testid="iphone-widget-key-row" :data-name="k.name">
          <template #sub><span class="sub" :data-last-used-local="usedLocal(k)" :data-never="k.lastUsedAt ? undefined : ''">{{ usedText(k) }}</span></template>
          <Button variant="text" data-testid="iphone-widget-revoke" @click="removing = k">{{ t('iphoneWidget.remove') }}</Button>
        </SettingRow>
        <SettingRow v-if="keys.length" id="iphoneWidgetAdd" link :label="t('iphoneWidget.addAnother')" testid="iphone-widget-add-another" @open="adding = true" />
      </template>
    </div>
    <SettingRow id="widgetCircle" wide :label="t('iphoneWidget.circle.label')">
      <template #sub><span class="sub" data-testid="settings-widget-circle-hint">{{ t('iphoneWidget.circle.hint') }}</span></template>
      <SegmentedButton connected :model-value="prefs.widgetCircle" :options="circleOptions" :label="t('iphoneWidget.circle.label')" data-testid="settings-widget-circle" @update:model-value="savePrefs({ widgetCircle: $event as WidgetCircle })" />
    </SettingRow>
    <SettingRow id="widgetLayout" wide :label="t('iphoneWidget.layout.label')">
      <template #sub><span class="sub" data-testid="settings-widget-layout-hint">{{ t('iphoneWidget.layout.hint') }}</span></template>
      <SegmentedButton connected :model-value="prefs.widgetLayout" :options="layoutOptions" :label="t('iphoneWidget.layout.label')" data-testid="settings-widget-layout" @update:model-value="savePrefs({ widgetLayout: $event as WidgetLayout })" />
    </SettingRow>
    <SettingRow id="widgetTimelineHours" wide :label="t('iphoneWidget.hours.label')">
      <template #sub><span class="sub" data-testid="settings-widget-range-hint">{{ t('iphoneWidget.hours.hint') }}</span></template>
      <SegmentedButton connected :model-value="prefs.widgetTimelineHours.mode" :options="hoursOptions" :label="t('iphoneWidget.hours.label')" data-testid="settings-widget-range" @update:model-value="saveHours({ mode: $event as TimelineHours['mode'] })" />
    </SettingRow>
    <div v-if="prefs.widgetTimelineHours.mode === 'fixed'" class="range">
      <TextField :model-value="prefs.widgetTimelineHours.from" type="time" :label="t('iphoneWidget.hours.from')" data-testid="settings-widget-range-from" @update:model-value="$event && saveHours({ from: $event })" />
      <TextField :model-value="prefs.widgetTimelineHours.to" type="time" :label="t('iphoneWidget.hours.to')" data-testid="settings-widget-range-to" @update:model-value="$event && saveHours({ to: $event })" />
    </div>
  </SettingSection>
  <IphoneWidgetSheet v-if="adding" @close="adding = false" />
  <ConfirmDialog :open="removing !== null" :title="t('iphoneWidget.removeTitle', { name: removing?.name ?? '' })" :message="t('iphoneWidget.removeMessage')" :ok-label="t('iphoneWidget.remove')" @ok="remove" @cancel="removing = null" />
</template>

<style scoped>
.range { display: flex; gap: 12px; padding: 0 16px 12px; }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
