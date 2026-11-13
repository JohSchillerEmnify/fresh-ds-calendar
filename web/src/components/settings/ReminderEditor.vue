<script setup lang="ts">
/**
 * The reminder list of one item or calendar as chips (feature reminders): each lead removable, an
 * "Add reminder" picker (5 / 10 / 15 / 30 min, 1 h, 1 h 30, 2 h, 1 day and a custom minutes field), at most 5. With
 * `allowDefault` (events, task lists) the list can also say "use the calendar default" (`defaultMinutes`, shown in words)
 * or "no reminders". The test ids carry `prefix`: `<prefix>-reminder` (chip, `data-minutes`), `-reminder-remove`,
 * `-reminder-add`, `-reminders-default`, `-reminder-option`, `-reminder-custom`.
 */
import Chip from '@/components/m3/Chip.vue';
import { computed, ref } from 'vue';
import { IconAdd } from '@/components/icons';
import type { Reminders } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import TextField from '@/components/m3/TextField.vue';
import { formatLead, formatLeads, MAX_REMINDERS, REMINDER_PRESETS } from '@/features/calendar/reminderPlan';
import { t } from '@/i18n';

const props = defineProps<{
  modelValue: Reminders;
  prefix: string;
  /** Events and task lists can use their calendar's default; a calendar's own default list cannot. */
  allowDefault?: boolean;
  /** The popup leads of the calendar default, for the "Calendar default (30 min, 10 min)" line. */
  defaultMinutes?: number[];
}>();
const emit = defineEmits<{ 'update:modelValue': [v: Reminders] }>();

const picking = ref(false);
const custom = ref('');
const customError = ref('');

const list = computed(() => (props.modelValue.useDefault ? [] : props.modelValue.minutes));
const full = computed(() => list.value.length >= MAX_REMINDERS);
const options = computed(() => REMINDER_PRESETS.filter((m) => !list.value.includes(m)));

/** Adds one lead (the list switches from the calendar default to an own list). */
function add(minutes: number) {
  if (full.value || list.value.includes(minutes)) return;
  emit('update:modelValue', { useDefault: false, minutes: [...list.value, minutes] });
  picking.value = false;
  custom.value = '';
  customError.value = '';
}
function remove(minutes: number) {
  emit('update:modelValue', { useDefault: false, minutes: list.value.filter((m) => m !== minutes) });
}
/** Adds the typed minutes when they are a whole number Google accepts (0 to 4 weeks). */
function addCustom() {
  const n = Number(custom.value.trim());
  if (custom.value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 40_320) { customError.value = t('calendar.reminders.customInvalid'); return; }
  if (list.value.includes(n)) { picking.value = false; return; }
  add(n);
}
const useDefault = () => { picking.value = false; emit('update:modelValue', { useDefault: true, minutes: [] }); };
const none = () => { picking.value = false; emit('update:modelValue', { useDefault: false, minutes: [] }); };
</script>

<template>
  <div class="rem" :data-use-default="modelValue.useDefault ? 'true' : 'false'">
    <p v-if="modelValue.useDefault" class="state" :data-testid="`${prefix}-reminders-state`">
      <span class="muted">{{ t('calendar.reminders.defaultLabel') }}:</span>{{ ' ' }}<span class="list" :data-testid="`${prefix}-reminders-default-list`">{{ defaultMinutes?.length ? formatLeads(defaultMinutes) : t('calendar.reminders.defaultNone') }}</span>
    </p>
    <ul v-else-if="list.length" class="chips">
      <li v-for="m in list" :key="m">
        <Chip variant="input" selected :remove-label="t('calendar.reminders.remove', { label: formatLead(m) })" :remove-testid="`${prefix}-reminder-remove`" :data-testid="`${prefix}-reminder`" :data-minutes="m" @remove="remove(m)">{{ formatLead(m) }}</Chip>
      </li>
    </ul>
    <p v-else class="state muted" :data-testid="`${prefix}-reminders-none`">{{ t('calendar.reminders.none') }}</p>

    <div class="acts">
      <Button variant="tonal" :disabled="full" :data-testid="`${prefix}-reminder-add`" @click="picking = !picking"><template #icon><IconAdd /></template>{{ t('calendar.reminders.add') }}</Button>
      <Button v-if="allowDefault && !modelValue.useDefault" variant="tonal" :data-testid="`${prefix}-reminders-default`" @click="useDefault">{{ t('calendar.reminders.useDefault') }}</Button>
      <Button v-if="allowDefault && (modelValue.useDefault || list.length)" variant="tonal" :data-testid="`${prefix}-reminders-none`" @click="none">{{ t('calendar.reminders.noReminders') }}</Button>
    </div>
    <p v-if="full" class="muted note" :data-testid="`${prefix}-reminders-max`">{{ t('calendar.reminders.max') }}</p>

    <div v-if="picking && !full" class="picker" role="group" :aria-label="t('calendar.reminders.pick')">
      <div class="opts">
        <Chip v-for="m in options" :key="m" variant="assist" :data-testid="`${prefix}-reminder-option`" :data-minutes="m" @click="add(m)">{{ formatLead(m) }}</Chip>
      </div>
      <div class="cust">
        <TextField v-model="custom" class="grow" type="number" inputmode="numeric" min="0" max="40320" step="1" :label="t('calendar.reminders.customLabel')" :error="customError" :data-testid="`${prefix}-reminder-custom`" data-enter-skip @keydown.enter.prevent.stop="addCustom" />
        <Button variant="outlined" :data-testid="`${prefix}-reminder-custom-add`" @click="addCustom">{{ t('calendar.reminders.customAdd') }}</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rem { display: flex; flex-direction: column; gap: 8px; }
.state { margin: 0; font: var(--md-sys-typescale-body-large); }
.muted { color: var(--md-sys-color-on-surface-variant); }
.note { margin: 0; font: var(--md-sys-typescale-label-medium); }
.list { font: var(--md-sys-typescale-label-large); }
.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.acts { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.picker { display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: var(--md-sys-shape-corner-medium); background: var(--md-sys-color-surface-container); }
.opts { display: flex; flex-wrap: wrap; gap: 8px; }
.cust { display: flex; align-items: flex-start; gap: 8px; }
.grow { flex: 1; min-width: 0; }
</style>
