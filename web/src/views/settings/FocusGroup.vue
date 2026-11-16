<script setup lang="ts">
/** Settings group Focus & calm (docs/settings-tree.md): calm mode, motion and sound, motivation, and the Bedtime page. */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { AnimationLevel, Motivation, StreakChoice, SupportCatSetting } from '@/api/types';
import { api } from '@/api/client';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Switch from '@/components/m3/Switch.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { useSavePrefs, useSaveSettings } from '@/composables/useSaveSettings';
import { StreakFlame, useMotivationStore } from '@/features/motivation';
import { t } from '@/i18n';
import { systemReducedMotion } from '@/motion';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();
const prefs = usePrefsStore();
const clock = useClockStore();
const device = useDeviceStore();
const save = useSaveSettings();
const savePrefs = useSavePrefs();
const s = computed(() => settings.settings);

const levels = computed(() => [{ value: 'full', label: t('settings.motion.full') }, { value: 'reduced', label: t('settings.motion.reduced') }, { value: 'off', label: t('common.off') }]);
const streakOptions = computed(() => (['off', 'flame', 'plant'] as const).map((v) => ({ value: v, label: t(`settings.motivation.streak.${v}`) })));
const supportCats = computed(() => [{ value: 'off', label: t('common.off') }, { value: 'sometimes', label: t('settings.motivation.supportSometimes') }, { value: 'always', label: t('settings.motivation.supportAlways') }]);

const best = ref<number | null>(null);
const motivation = useMotivationStore();
const currentStreak = computed(() => motivation.motivation?.streak.current ?? null);
onMounted(() => {
  // The top bar (which normally starts the check-in) is not shown on this page.
  void motivation.start({ today: () => clock.today }).then(() => { if (motivation.motivation) best.value = motivation.motivation.streak.best; });
  device.read('motivation', () => api.motivation()).then((m: Motivation) => { best.value = m.streak.best; }, () => { best.value = null; });
});
onBeforeUnmount(() => motivation.stop());
</script>

<template>
  <SettingSection>
    <SettingRow id="calmMode" :label="t('settings.motivation.calmMode.label')" :hint="t('settings.motivation.calmMode.hint')">
      <Switch :model-value="s.calmMode" :label="t('settings.motivation.calmMode.label')" data-testid="settings-calm-mode" @update:model-value="save({ calmMode: $event })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.motion')">
    <SettingRow id="animations" wide :label="t('settings.motion.animations')">
      <template v-if="systemReducedMotion" #sub><span class="sub" data-testid="settings-system-reduced-motion">{{ t('settings.motion.systemReduced') }}</span></template>
      <SegmentedButton :model-value="s.animationLevel" :options="levels" :label="t('settings.motion.animations')" data-testid="settings-animation-level" @update:model-value="save({ animationLevel: $event as AnimationLevel })" />
    </SettingRow>
    <SettingRow v-if="systemReducedMotion" id="ignoreSystemMotion" :label="t('settings.motion.ignoreSystem.label')" :hint="t('settings.motion.ignoreSystem.hint')">
      <Switch :model-value="s.ignoreSystemMotion" :label="t('settings.motion.ignoreSystem.label')" data-testid="settings-ignore-system-motion" @update:model-value="save({ ignoreSystemMotion: $event })" />
    </SettingRow>
    <SettingRow id="sounds" :label="t('settings.motion.sounds')">
      <Switch :model-value="s.sounds" :label="t('settings.motion.sounds')" data-testid="settings-sounds" @update:model-value="save({ sounds: $event })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.motivation')">
    <SettingRow id="streak" wide :label="t('settings.motivation.streak.label')">
      <template #sub>
        <span class="sub streak">
          <template v-if="currentStreak !== null">{{ t('settings.motivation.currentStreak') }} <StreakFlame :count="currentStreak" /> · </template>
          {{ t('settings.motivation.bestStreak') }} <span data-testid="settings-best-streak">{{ best ?? '–' }}</span>
        </span>
      </template>
      <SegmentedButton :model-value="prefs.streak" :options="streakOptions" :label="t('settings.motivation.streak.label')" data-testid="settings-streak" @update:model-value="savePrefs({ streak: $event as StreakChoice })" />
    </SettingRow>
    <SettingRow id="supportCat" wide :label="t('settings.motivation.supportCat')">
      <SegmentedButton :model-value="prefs.supportCat" :options="supportCats" :label="t('settings.motivation.supportCat')" data-testid="settings-support-cat" @update:model-value="savePrefs({ supportCat: $event as SupportCatSetting })" />
    </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.bedtime')">
    <SettingRow id="bedtime" to="/settings/focus/bedtime" :label="t('settings.sections.bedtime')" :hint="t('settingsNav.labels.bedtimeHint')" testid="settings-bedtime" />
  </SettingSection>

</template>

<style scoped>
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.streak { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; }
</style>
