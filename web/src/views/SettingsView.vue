<script setup lang="ts">
/** The settings home (features settings-groups, settings-search): search bar and groups; results open the group page at the row; the query lives in the URL. */
import { computed, onMounted, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IconAccountCircleOutline, IconCalendarMonth, IconChecklist, IconClose, IconNotificationsOutline, IconPaletteOutline,
  IconScienceOutline, IconSearch, IconSelfImprovement, IconViewAgenda,
} from '@/components/icons';
import IconButton from '@/components/m3/IconButton.vue';
import Pressable from '@/components/m3/Pressable.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingsShell from '@/components/settings/SettingsShell.vue';
import { GROUP_IDS, resolveTarget, searchSettings, searchSources, settingRoute, type GroupId, type SearchHit } from '@/components/settings/catalog';
import { t } from '@/i18n';
import { systemReducedMotion } from '@/motion';
import { useCalendarsStore } from '@/stores/calendars';
import { usePrefsStore } from '@/stores/prefs';

const route = useRoute();
const router = useRouter();
const prefs = usePrefsStore();
const cals = useCalendarsStore();
onMounted(() => { void cals.load().catch(() => undefined); });

const ICONS: Record<GroupId, Component> = {
  calendars: IconCalendarMonth, views: IconViewAgenda, tasklists: IconChecklist, reminders: IconNotificationsOutline,
  appearance: IconPaletteOutline, focus: IconSelfImprovement, labs: IconScienceOutline, account: IconAccountCircleOutline,
};

const query = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''));
function setQuery(q: string) {
  void router.replace({ query: q ? { q } : {} });
}
const hits = computed(() => searchSettings(query.value, searchSources(cals.list)));

/** Whether a setting currently shows the settings that depend on it (see `resolveTarget`). */
const ON: Record<string, () => boolean> = {
  labs: () => prefs.labs,
  approachingCard: () => prefs.approachingCard,
  approachBar: () => prefs.approachBar,
  morning: () => prefs.notify.morning,
  weekTwoRow: () => prefs.weekTwoRow,
  handwriting: () => prefs.labsHandwriting,
  bedtimeOn: () => prefs.bedtime.enabled,
  bedtimeMode: () => prefs.bedtime.mode === 'dynamic',
  animations: () => systemReducedMotion.value,
};
const isOn = (id: string) => ON[id]?.() ?? false;

function choose(hit: SearchHit) {
  if (hit.id.startsWith('calendar:')) { void router.push(settingRoute({ group: 'calendars' }, hit.id)); return; }
  const target = resolveTarget(hit.id, isOn);
  if (target) void router.push(settingRoute(target, target.id));
}
</script>

<template>
  <SettingsShell :title="t('settings.title')" up="/">
    <div class="home" data-testid="settings-home">
      <label class="search">
        <IconSearch class="lead" aria-hidden="true" />
        <input
          :value="query" type="search" enterkeyhint="search" autocomplete="off" :placeholder="t('settingsNav.home.search')" :aria-label="t('settingsNav.home.search')"
          data-testid="settings-search" @input="setQuery(($event.target as HTMLInputElement).value)"
        />
        <IconButton v-if="query" :label="t('settingsNav.home.clear')" data-testid="settings-search-clear" @click="setQuery('')"><IconClose /></IconButton>
      </label>

      <ul v-if="query" class="list" :aria-label="t('settingsNav.home.results')">
        <li v-for="h in hits" :key="h.id">
          <Pressable class="result" data-testid="settings-search-result" :data-setting="h.label" :data-path="h.path" @click="choose(h)">
            <span class="lab">{{ h.label }}</span><span class="sub">{{ h.path }}</span>
          </Pressable>
        </li>
        <li v-if="!hits.length" class="empty" data-testid="settings-search-empty">{{ t('settingsNav.home.empty', { q: query }) }}</li>
      </ul>

      <nav v-else class="list" :aria-label="t('settings.sectionsLabel')">
        <SettingRow
          v-for="g in GROUP_IDS" :id="g" :key="g" :to="`/settings/${g}`" :label="t(`settingsNav.groups.${g}.title`)" :hint="t(`settingsNav.groups.${g}.summary`)"
          class="group" data-testid="settings-group" :data-group="t(`settingsNav.groups.${g}.title`)" :data-group-id="g"
        >
          <template #sub><component :is="ICONS[g]" class="icon" aria-hidden="true" /></template>
        </SettingRow>
      </nav>
    </div>
  </SettingsShell>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: 8px; }
.search {
  display: flex; align-items: center; gap: 4px; min-height: 56px; margin: 4px 8px 8px; padding: 0 4px 0 16px; border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant);
}
.search:focus-within { outline: 2px solid var(--md-sys-color-primary); }
.lead { width: 24px; height: 24px; flex: none; }
.search input { flex: 1; min-width: 0; height: 48px; border: 0; outline: 0; background: transparent; color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-body-large); padding: 0 8px; }
.search input::-webkit-search-cancel-button { display: none; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.result { display: flex; flex-direction: column; align-items: flex-start; width: 100%; min-height: 64px; padding: 10px 16px; text-align: left; color: inherit; border-radius: var(--md-sys-shape-corner-large); }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .result:hover { background: var(--md-sys-color-surface-container-high); } }
.lab { font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.empty { padding: 24px 16px; text-align: center; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface-variant); }
.group { position: relative; padding-left: 72px; }
.icon {
  position: absolute; left: 16px; top: 50%; width: 40px; height: 40px; margin-top: -20px; padding: 8px; box-sizing: border-box; border-radius: 50%;
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
}
</style>
