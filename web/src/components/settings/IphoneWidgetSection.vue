<script setup lang="ts">
/** The iPhone widget section of Settings › Account & app (feature iphone-widget): the devices with a widget key, add and remove. */
import { computed, onMounted, ref } from 'vue';
import type { WidgetCircle, WidgetKey } from '@/api/types';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Button from '@/components/m3/Button.vue';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import IphoneWidgetSheet from '@/components/settings/IphoneWidgetSheet.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { dateLocale, t } from '@/i18n';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { usePrefsStore } from '@/stores/prefs';
import { useBackupStore } from '@/stores/backup';
import { useClockStore } from '@/stores/clock';
import { useUiStore } from '@/stores/ui';
import { useWidgetKeysStore } from '@/stores/widgetKeys';

const keys = useWidgetKeysStore();
const clock = useClockStore();
const backup = useBackupStore();
const ui = useUiStore();
const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
const circleOptions = computed(() => (['time', 'countdown'] as const).map((v) => ({ value: v, label: t(`iphoneWidget.circle.${v}`), testid: `settings-widget-circle-${v}` })));
const adding = ref(false);
const removing = ref<WidgetKey | null>(null);

// the list shows at once from the device (last known state) and is read again here: the widget may have been used since
onMounted(() => { keys.load().then(() => keys.refresh()).catch(() => undefined); });

const usedText = (k: WidgetKey) => (k.lastUsedAt ? t('iphoneWidget.lastUsed', { time: backup.formatTime(k.lastUsedAt, clock.timeZone) }) : t('iphoneWidget.never'));
/** "2026-10-13 18:30" in the calendar's time zone, for tests and assistive tools. */
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
  try { await keys.remove(k.id); } catch { ui.notify(t('iphoneWidget.failed')); }
}
</script>

<template>
  <SettingSection :title="t('iphoneWidget.title')">
    <div data-testid="iphone-widget-keys">
      <SettingRow v-if="keys.loaded && !keys.keys.length" id="iphoneWidget" :label="t('iphoneWidget.intro')">
        <Button variant="tonal" data-testid="iphone-widget-add" @click="adding = true">{{ t('iphoneWidget.add') }}</Button>
      </SettingRow>
      <template v-else>
        <SettingRow v-for="k in keys.keys" :id="`iphoneWidget-${k.id}`" :key="k.id" :label="k.name" testid="iphone-widget-key-row" :data-name="k.name">
          <template #sub><span class="sub" :data-last-used-local="usedLocal(k)" :data-never="k.lastUsedAt ? undefined : ''">{{ usedText(k) }}</span></template>
          <Button variant="text" data-testid="iphone-widget-revoke" @click="removing = k">{{ t('iphoneWidget.remove') }}</Button>
        </SettingRow>
        <SettingRow v-if="keys.keys.length" id="iphoneWidgetAdd" link :label="t('iphoneWidget.addAnother')" testid="iphone-widget-add-another" @open="adding = true" />
      </template>
    </div>
    <SettingRow id="widgetCircle" wide :label="t('iphoneWidget.circle.label')">
      <template #sub><span class="sub" data-testid="settings-widget-circle-hint">{{ t('iphoneWidget.circle.hint') }}</span></template>
      <SegmentedButton connected :model-value="prefs.widgetCircle" :options="circleOptions" :label="t('iphoneWidget.circle.label')" data-testid="settings-widget-circle" @update:model-value="savePrefs({ widgetCircle: $event as WidgetCircle })" />
    </SettingRow>
  </SettingSection>
  <IphoneWidgetSheet v-if="adding" @close="adding = false" />
  <ConfirmDialog :open="removing !== null" :title="t('iphoneWidget.removeTitle', { name: removing?.name ?? '' })" :message="t('iphoneWidget.removeMessage')" :ok-label="t('iphoneWidget.remove')" @ok="remove" @cancel="removing = null" />
</template>

<style scoped>
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
