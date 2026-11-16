<script setup lang="ts">
import { useRouter } from 'vue-router';
import { IconSettingsOutline as IconSettings } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import Checkbox from '@/components/m3/Checkbox.vue';
import ListItem from '@/components/m3/ListItem.vue';
import NavigationDrawer from '@/components/m3/NavigationDrawer.vue';
import type { NavItem } from '@/components/m3/types';
import { useCalendarsStore } from '@/stores/calendars';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';
import { vLongPress } from '@/lib/longPress';

/** The side menu (feature nav-expressive): the views, the calendars with colour checkboxes (they replace the filter button) and Settings at the bottom. */
const props = defineProps<{ items: NavItem[]; modelValue: string; side: 'left' | 'right' }>();
const emit = defineEmits<{ 'update:modelValue': [id: string] }>();
const ui = useUiStore();
const calendars = useCalendarsStore();
const router = useRouter();

function choose(id: string) {
  ui.sideMenuOpen = false;
  emit('update:modelValue', id);
}
function openPlan(id: string) {
  ui.sideMenuOpen = false;
  ui.openDialog('calendar-plan', { calendarId: id });
}
function openSettings() {
  ui.sideMenuOpen = false;
  void router.push('/settings');
}
</script>

<template>
  <NavigationDrawer :open="ui.sideMenuOpen" :label="t('nav.menu')" :items="props.items" :model-value="props.modelValue" :side="side" @close="ui.sideMenuOpen = false" @update:model-value="choose">
    <h2 class="h">{{ t('nav.calendars') }}</h2>
    <ListItem v-for="k in calendars.list" :key="k.id" v-long-press="() => openPlan(k.id)" tag="label" class="cal" data-testid="side-menu-calendar" :data-name="k.name" :data-calendar-id="k.id">
      <template #leading><Checkbox :model-value="!calendars.isHidden(k.id)" :label="k.name" :color="k.color" @change="calendars.toggle(k.id)" /></template>
      {{ k.name }}
    </ListItem>
    <template #footer>
      <Button variant="text" class="set" data-testid="side-menu-settings" @click="openSettings"><template #icon><IconSettings /></template>{{ t('calendar.topBar.settings') }}</Button>
    </template>
  </NavigationDrawer>
</template>

<style scoped>
.h { margin: 0; padding: 4px 16px; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface-variant); }
.cal { cursor: pointer; padding-left: 4px; gap: 4px; }
.set { width: 100%; justify-content: flex-start; }
</style>
