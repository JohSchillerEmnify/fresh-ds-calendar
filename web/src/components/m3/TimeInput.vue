<script setup lang="ts">
/** The M3 time picker's input mode: a large hour box, the separator and a large minute box, each with its caption below. */
defineProps<{
  hour: string; minute: string; hourLabel: string; minuteLabel: string;
  /** data-testids of the two inputs. */
  hourTestid?: string; minuteTestid?: string;
}>();
const emit = defineEmits<{ 'update:hour': [v: string]; 'update:minute': [v: string] }>();
const on = (e: Event) => (e.target as HTMLInputElement).value;
</script>

<template>
  <div class="time-input">
    <label class="box">
      <input class="in" :value="hour" inputmode="numeric" maxlength="2" :aria-label="hourLabel" :data-testid="hourTestid" @input="emit('update:hour', on($event))" />
      <span class="cap">{{ hourLabel }}</span>
    </label>
    <span class="colon" aria-hidden="true">:</span>
    <label class="box">
      <input class="in" :value="minute" inputmode="numeric" maxlength="2" :aria-label="minuteLabel" :data-testid="minuteTestid" @input="emit('update:minute', on($event))" />
      <span class="cap">{{ minuteLabel }}</span>
    </label>
  </div>
</template>

<style scoped>
/* material-components-android timepicker: input boxes 96 x 80 (material_clock_display_*), display-large 56 text centred, 2 px focus outline in primary,
   captions as supporting text; the container colours follow the M3 spec (unverified: the token macros are not in the repository's resource files) */
.time-input { display: flex; align-items: flex-start; gap: 4px; }
.box { display: flex; flex-direction: column; gap: 6px; }
.in {
  width: 96px; height: 80px; box-sizing: border-box; padding: 0; text-align: center; border: 0; border-radius: var(--md-sys-shape-corner-small);
  background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface); font: 400 calc(56px * var(--dz, 1))/64px var(--font);
}
.in:focus { outline: 2px solid var(--md-sys-color-primary); background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.colon { font: 400 calc(56px * var(--dz, 1))/80px var(--font); width: 24px; text-align: center; color: var(--md-sys-color-on-surface); }
.cap { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
