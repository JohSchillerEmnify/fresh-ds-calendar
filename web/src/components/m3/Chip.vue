<script setup lang="ts">
import { vRipple } from '@/lib/ripple';
import { IconClose } from '@/components/icons';

/** `input` is a removed-by-its-x value (not a button itself); `static` draws the same chip without taking part in tapping (inside another button). */
defineProps<{ selected?: boolean; variant?: 'filter' | 'assist' | 'input'; static?: boolean; removeLabel?: string; removeTestid?: string }>();
defineEmits<{ remove: [] }>();
</script>

<template>
  <span v-if="variant === 'input' || static" class="chip" :class="[variant ?? 'filter', { selected, remove: variant === 'input' }]">
    <span v-if="$slots.leading" class="lead"><slot name="leading" /></span>
    <span class="txt"><slot /></span>
    <button v-if="variant === 'input'" v-ripple class="x" type="button" :aria-label="removeLabel" :title="removeLabel" :data-testid="removeTestid" @click="$emit('remove')"><IconClose /></button>
  </span>
  <button v-else v-ripple class="chip" :class="[variant ?? 'filter', { selected }]" type="button" :aria-pressed="variant === 'assist' ? undefined : !!selected">
    <span v-if="$slots.leading" class="lead"><slot name="leading" /></span>
    <span class="txt"><slot /></span>
  </button>
</template>

<style scoped>
/* 32 px high at Comfortable (moved by the density shift) with small corners: container-height and container-shape of
   _md-comp-filter-chip / _md-comp-assist-chip / _md-comp-input-chip */
.chip {
  --h: calc(32px + var(--md-density-shift)); height: var(--h);
  position: relative; flex: none; padding: 0 14px; border-radius: var(--md-sys-shape-corner-small);
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  border: 1px solid var(--md-sys-color-outline); color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large);
  transition: background var(--md-sys-motion-duration-short);
}
button.chip::after { content: ''; position: absolute; inset: -4px 0; }
.chip.selected { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); border-color: transparent; }
/* the remove x takes the trailing 8 px; its 48 px tap area reaches past the chip */
.chip.remove { padding-inline-end: 8px; }
.x { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: var(--md-sys-shape-corner-full); color: inherit; }
.x::after { content: ''; position: absolute; inset: -15px; }
.x :deep(svg) { width: 18px; height: 18px; }
.lead { display: inline-flex; align-items: center; }
.lead :deep(svg) { width: 18px; height: 18px; }
.txt { overflow: hidden; text-overflow: ellipsis; }
</style>
