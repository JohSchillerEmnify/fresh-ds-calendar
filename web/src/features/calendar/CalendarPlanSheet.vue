<script setup lang="ts">
/** One calendar's plan (feature calendar-off-plan): a weekly off-window and/or off until 00:00 of a day; from chip, side menu or Settings. */
import { computed, ref } from 'vue';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import Select from '@/components/m3/Select.vue';
import Switch from '@/components/m3/Switch.vue';
import TextField from '@/components/m3/TextField.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import { EVENT_COLOR_OPTIONS } from '@/api/colors';
import { t, type MessageKey } from '@/i18n';
import { weekdayLabels } from '@/lib/dates';
import { awayActive } from '@/lib/calendarPlan';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';

const props = defineProps<{ calendarId: string }>();
const emit = defineEmits<{ close: [] }>();
const cals = useCalendarsStore();
const clock = useClockStore();
const cal = computed(() => cals.list.find((c) => c.id === props.calendarId));
const plan = cals.planOf(props.calendarId);

/** Step values `Sun`..`Sat` are the plan's days 0..6; labels follow the language, Monday first. */
const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const dayOptions = computed(() => weekdayLabels().map((label, i) => ({ value: DAY_KEYS[(i + 1) % 7], label })));
const win = plan?.windows?.[0];
const timed = ref(!!win);
const fromDay = ref<string>(DAY_KEYS[win?.from.day ?? 5]);
const fromTime = ref(win?.from.time ?? '17:00');
const toDay = ref<string>(DAY_KEYS[win?.to.day ?? 0]);
const toTime = ref(win?.to.time ?? '16:00');
const away = ref(awayActive(plan, cals.nowWall));
const until = ref(away.value && plan?.until ? plan.until : clock.today);
const saving = ref(false);

/** The 11 Google colours as in the event dialog; the calendar's own colour is chosen when it is one of them. */
const swatches = EVENT_COLOR_OPTIONS.map((c) => ({ value: c.hex, name: t(`calendar.event.colors.${c.name.toLowerCase()}` as MessageKey), color: c.hex, testid: 'calendar-color-option' }));
/** Recolours the calendar at once; a refused save puts the old colour back (the store rolls back). */
function pick(hex: string) {
  void cals.setColor(props.calendarId, hex).catch(() => undefined);
}

const sameEdge = computed(() => timed.value && fromDay.value === toDay.value && fromTime.value === toTime.value);
const untilBad = computed(() => away.value && !(until.value > clock.today));

function alwaysOn() {
  timed.value = false;
  away.value = false;
}

async function done() {
  if (sameEdge.value || untilBad.value) return;
  saving.value = true;
  try {
    const windows = timed.value ? [{ from: { day: DAY_KEYS.indexOf(fromDay.value as never), time: fromTime.value }, to: { day: DAY_KEYS.indexOf(toDay.value as never), time: toTime.value } }] : undefined;
    // the store keeps an untouched "Off for a while" counting from its first start
    const keepSince = away.value && plan?.until === until.value ? plan.since : undefined;
    await cals.setPlan(props.calendarId, timed.value || away.value ? { windows, until: away.value ? until.value : undefined, since: keepSince } : undefined);
    emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdaptiveSheet :open="true" :label="cal?.name ?? ''" testid="calendar-plan-sheet" @close="emit('close')">
    <div class="sheet">
      <h2 class="t"><i class="dot" :style="{ background: cal?.color }" />{{ cal?.name }}</h2>
      <ColorSwatchPicker :model-value="cal?.color?.toLowerCase() ?? null" :swatches="swatches" :label="t('calendar.event.fields.color')" radio data-testid="calendar-color" @update:model-value="pick" />
      <Button variant="text" class="always" @click="alwaysOn">{{ t('calendar.plan.alwaysOn') }}</Button>
      <section class="sec">
        <div class="row"><span class="lbl">{{ t('calendar.plan.timed') }}</span><Switch v-model="timed" :label="t('calendar.plan.timed')" /></div>
        <template v-if="timed">
          <div class="pair">
            <Select v-model="fromDay" :options="dayOptions" :label="t('calendar.plan.from')" data-testid="calendar-plan-from-day" />
            <TextField v-model="fromTime" type="time" :label="t('calendar.plan.fromTime')" data-testid="calendar-plan-from-time" />
          </div>
          <div class="pair">
            <Select v-model="toDay" :options="dayOptions" :label="t('calendar.plan.to')" data-testid="calendar-plan-to-day" />
            <TextField v-model="toTime" type="time" :label="t('calendar.plan.toTime')" data-testid="calendar-plan-to-time" />
          </div>
          <p class="hint" :class="{ err: sameEdge }">{{ sameEdge ? t('calendar.plan.sameEdge') : t('calendar.plan.timedHint') }}</p>
        </template>
      </section>
      <section class="sec">
        <div class="row"><span class="lbl">{{ t('calendar.plan.away') }}</span><Switch v-model="away" :label="t('calendar.plan.away')" /></div>
        <template v-if="away">
          <TextField v-model="until" type="date" :label="t('calendar.plan.backOn')" data-testid="calendar-plan-until" />
          <p class="hint" :class="{ err: untilBad }">{{ untilBad ? t('calendar.plan.untilPast') : t('calendar.plan.awayHint') }}</p>
        </template>
      </section>
      <Button class="done" :disabled="saving" @click="done">{{ t('calendar.plan.done') }}</Button>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.sheet { display: flex; flex-direction: column; gap: 8px; padding: 8px 20px 20px; }
.t { display: flex; align-items: center; gap: 8px; margin: 0; font: var(--md-sys-typescale-title-large); color: var(--md-sys-color-on-surface); }
.dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
.always { align-self: flex-start; }
.sec { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; border-top: 1px solid var(--md-sys-color-outline-variant); }
.row { display: flex; align-items: center; justify-content: space-between; min-height: 48px; }
.lbl { font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hint { margin: 0; font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); }
.hint.err { color: var(--md-sys-color-error); }
.done { align-self: stretch; margin-top: 8px; }
</style>
