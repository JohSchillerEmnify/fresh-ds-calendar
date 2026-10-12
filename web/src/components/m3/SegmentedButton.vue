<script setup lang="ts" generic="T extends string">
import { vRipple } from '@/lib/ripple';
import IconCheck from '~icons/material-symbols/check';
import type { Option } from './types';

defineProps<{ modelValue: T; options: Option<T>[]; label: string }>();
defineEmits<{ 'update:modelValue': [v: T] }>();
</script>

<template>
  <div class="seg" role="group" :aria-label="label">
    <button
      v-for="o in options" :key="o.value" v-ripple type="button" class="opt" :class="{ on: o.value === modelValue }"
      :aria-pressed="o.value === modelValue" :data-value="o.value" :data-testid="o.testid" @click="$emit('update:modelValue', o.value)"
    >
      <IconCheck v-if="o.value === modelValue" class="chk" aria-hidden="true" />
      <span>{{ o.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.seg { display: flex; border: 1px solid var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-full); overflow: hidden; max-width: 100%; }
.opt {
  flex: 1; min-height: 44px; padding: 0 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface); white-space: nowrap;
}
.opt + .opt { border-left: 1px solid var(--md-sys-color-outline); }
.opt.on { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.chk { width: 18px; height: 18px; }
</style>
