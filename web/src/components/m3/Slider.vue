<script setup lang="ts">
/**
 * Slider: a labelled native `input[type=range]` with its value shown next to the label. Keyboard (arrows, Home/End,
 * PageUp/PageDown) and screen readers come from the native control; `valueText` is what is shown and announced
 * (`aria-valuetext`, e.g. "4 px"). `update:modelValue` fires while moving (live preview), `commit` when a move ends
 * (pointer release, or each keyboard step), so callers can save once.
 */
defineProps<{ modelValue: number; min: number; max: number; label: string; valueText: string; step?: number; disabled?: boolean; testid?: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: number]; commit: [v: number] }>();
</script>

<template>
  <div class="slider" :class="{ off: disabled }">
    <label class="row">
      <span class="lab">{{ label }}</span>
      <output class="val" :data-testid="testid ? `${testid}-value` : undefined">{{ valueText }}</output>
      <input
        type="range" :min="min" :max="max" :step="step ?? 1" :value="modelValue" :disabled="disabled" :aria-valuetext="valueText"
        :data-testid="testid" @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
        @change="emit('commit', Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </div>
</template>

<style scoped>
.row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0 12px; }
.lab { font: var(--md-sys-typescale-body-large); padding: 4px 4px 0; }
.val { font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface-variant); font-variant-numeric: tabular-nums; }
input { grid-column: 1 / -1; width: 100%; min-height: 44px; margin: 0; accent-color: var(--md-sys-color-primary); cursor: pointer; background: transparent; }
input:disabled { cursor: default; }
.off { opacity: 0.38; }
input:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; border-radius: var(--md-sys-shape-corner-full); }
</style>
