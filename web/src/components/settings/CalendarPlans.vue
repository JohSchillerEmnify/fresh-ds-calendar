<script setup lang="ts">
import { IconChevronRight as IconNext } from '@/components/icons';
import Pressable from '@/components/m3/Pressable.vue';
import { t } from '@/i18n';
import { backDay, windowEnds } from '@/lib/calendarPlan';
import { useCalendarsStore } from '@/stores/calendars';
import { useUiStore } from '@/stores/ui';

/** Settings › Calendars: each calendar with its plan; a tap opens the plan sheet (feature calendar-off-plan, the route without a gesture). */
const cals = useCalendarsStore();
const ui = useUiStore();

/** "Off Fri 17:00 – Sun 16:00 · Back Tue 10", or "Always on". */
function summary(id: string): string {
  const plan = cals.planOf(id);
  const w = windowEnds(plan);
  const back = backDay(plan, cals.nowWall);
  const parts = [w ? t('calendar.plan.window', w) : '', back ? t('calendar.plan.back', { day: back }) : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : t('calendar.plan.alwaysOn');
}
</script>

<template>
  <div class="plans">
    <span class="lab">{{ t('calendar.plan.settings') }}</span>
    <Pressable
      v-for="k in cals.list" :key="k.id" type="button" class="row link" data-testid="settings-calendar-plan" :data-name="k.name"
      @click="ui.openDialog('calendar-plan', { calendarId: k.id })"
    >
      <i class="dot" :style="{ background: k.color }" />
      <span class="grow"><span class="name">{{ k.name }}</span><span class="sub">{{ summary(k.id) }}</span></span>
      <IconNext aria-hidden="true" />
    </Pressable>
  </div>
</template>

<style scoped>
.plans { display: flex; flex-direction: column; padding: 8px 0; }
.row { display: flex; align-items: center; gap: 12px; min-height: 56px; width: 100%; text-align: start; color: var(--md-sys-color-on-surface); }
.grow { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.name { font: var(--md-sys-typescale-body-large); }
.sub { font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); }
.lab { font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface); }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
</style>
