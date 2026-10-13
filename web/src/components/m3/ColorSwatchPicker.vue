<script setup lang="ts">
import { IconCheck } from '@/components/icons';
import { onColor } from '@/api/colors';

import type { Swatch } from './types';
defineProps<{ swatches: Swatch[]; modelValue: string | null; label: string; radio?: boolean }>();
defineEmits<{ 'update:modelValue': [v: string] }>();
</script>

<template>
  <div class="swatches" data-no-sheet-drag :role="radio ? 'radiogroup' : 'group'" :aria-label="label">
    <button
      v-for="s in swatches" :key="s.value" type="button" class="sw" :role="radio ? 'radio' : undefined" :aria-checked="radio ? s.value === modelValue : undefined" :aria-pressed="radio ? undefined : s.value === modelValue" :aria-label="s.name" :title="s.name"
      :data-name="s.name" :data-color="s.color" :data-testid="s.testid" @click="$emit('update:modelValue', s.value)"
    >
      <span class="dot" :style="{ background: s.color, color: onColor(s.color) }"><IconCheck v-if="s.value === modelValue" /></span>
    </button>
  </div>
</template>

<style scoped>
.swatches { display: flex; flex-wrap: wrap; gap: 2px; }
.sw { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; }
.dot { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12); }
.dot :deep(svg) { width: 22px; height: 22px; }
.sw[aria-pressed='true'] .dot, .sw[aria-checked='true'] .dot { transform: scale(1.1); }
.sw:active .dot { transform: scale(0.9); }
</style>
