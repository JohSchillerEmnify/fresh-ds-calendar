<script setup lang="ts">
/** A time at the end of a settings row: tapping opens the M3 time picker (input mode: hour and minute fields) in a sheet. */
import { computed, ref } from 'vue';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import { t } from '@/i18n';

defineOptions({ inheritAttrs: false });
const props = defineProps<{ modelValue: string; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: string] }>();
const open = ref(false);
const hour = ref('');
const minute = ref('');
/** Two digits each, within a day. */
const valid = computed(() => /^\d{1,2}$/.test(hour.value) && /^\d{1,2}$/.test(minute.value) && Number(hour.value) < 24 && Number(minute.value) < 60);

function show() {
  [hour.value, minute.value] = props.modelValue.split(':');
  open.value = true;
}
function ok() {
  if (!valid.value) return;
  emit('update:modelValue', `${hour.value.padStart(2, '0')}:${minute.value.padStart(2, '0')}`);
  open.value = false;
}
</script>

<template>
  <Button v-bind="$attrs" variant="text" :aria-label="`${label}: ${modelValue}`" @click="show">{{ modelValue }}</Button>
  <AdaptiveSheet :open="open" :label="t('settingsNav.time.title')" testid="time-picker" @close="open = false">
    <form class="f" @submit.prevent="ok">
      <h2 class="t">{{ label }}</h2>
      <div class="hm">
        <label class="box"><input v-model="hour" class="in" inputmode="numeric" maxlength="2" :aria-label="t('settingsNav.time.hour')" data-testid="time-picker-hour" /><span class="cap">{{ t('settingsNav.time.hour') }}</span></label>
        <span class="colon" aria-hidden="true">:</span>
        <label class="box"><input v-model="minute" class="in" inputmode="numeric" maxlength="2" :aria-label="t('settingsNav.time.minute')" data-testid="time-picker-minute" /><span class="cap">{{ t('settingsNav.time.minute') }}</span></label>
      </div>
      <div class="actions">
        <Button variant="text" data-testid="time-picker-cancel" @click="open = false">{{ t('settingsNav.time.cancel') }}</Button>
        <Button variant="text" type="submit" :disabled="!valid" data-testid="time-picker-ok">{{ t('settingsNav.time.ok') }}</Button>
      </div>
    </form>
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 16px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.hm { display: flex; align-items: flex-start; gap: 4px; }
.box { display: flex; flex-direction: column; gap: 6px; }
.in {
  width: 96px; height: 72px; box-sizing: border-box; text-align: center; border: 0; border-radius: var(--md-sys-shape-corner-small);
  background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-display-medium);
}
.in:focus { outline: 2px solid var(--md-sys-color-primary); background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.colon { font: var(--md-sys-typescale-display-large); line-height: 72px; width: 24px; text-align: center; }
.cap { font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
