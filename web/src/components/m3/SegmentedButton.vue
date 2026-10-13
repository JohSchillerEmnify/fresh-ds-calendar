<script setup lang="ts" generic="T extends string">
import { vRipple } from '@/lib/ripple';
import { IconCheck } from '@/components/icons';
import type { Option } from './types';

defineProps<{ modelValue: T; options: Option<T>[]; label: string; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [v: T] }>();
</script>

<template>
  <div class="seg" role="group" :aria-label="label">
    <button
      v-for="o in options" :key="o.value" v-ripple type="button" class="opt" :class="{ on: o.value === modelValue }" :disabled="disabled"
      :aria-pressed="o.value === modelValue" :data-value="o.value" :data-testid="o.testid" @click="$emit('update:modelValue', o.value)"
    >
      <IconCheck v-if="o.value === modelValue" class="chk" aria-hidden="true" />
      <span class="lbl"><slot name="option" :option="o" />{{ o.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.seg { display: flex; border: 1px solid var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-full); overflow: hidden; max-width: 100%; }
.opt {
  flex: 1; min-height: 44px; padding: 0 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface);
  /* long labels (translations) wrap inside their segment instead of spilling into the next one */
  min-width: 0; text-align: center; overflow-wrap: anywhere; padding-block: 6px;
}
.opt + .opt { border-left: 1px solid var(--md-sys-color-outline); }
.opt.on { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.opt:disabled { opacity: 0.38; cursor: default; }
.chk { width: 18px; height: 18px; }
.lbl { display: inline-flex; align-items: center; gap: 6px; }
</style>
