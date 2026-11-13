<script setup lang="ts" generic="T extends string">
import { useResizeObserver } from '@vueuse/core';
import { nextTick, onMounted, ref, watch } from 'vue';
import { vRipple } from '@/lib/ripple';
import { IconCheck } from '@/components/icons';
import type { Option } from './types';

/** The expressive connected button group (touching buttons, round ends); it stacks, one option per line, when the labels do not fit one line. */
const props = defineProps<{ modelValue: T; options: Option<T>[]; label: string; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [v: T] }>();
const root = ref<HTMLElement | null>(null);
const stacked = ref(false);

/** Decides between one row and a stack by trying one row: the buttons never wrap there, so too little room shows as overflow. */
async function fit(): Promise<void> {
  const el = root.value;
  if (!el) return;
  stacked.value = false;
  await nextTick();
  stacked.value = el.scrollWidth > el.clientWidth + 1;
}
onMounted(fit);
watch(() => [props.options, props.modelValue], fit);
let lastWidth = 0;
// only a change of width can change the answer (stacking changes the height)
useResizeObserver(root, ([e]) => { if (e.contentRect.width !== lastWidth) { lastWidth = e.contentRect.width; void fit(); } });
</script>

<template>
  <div ref="root" class="seg" :class="{ stacked }" role="group" :aria-label="label">
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
/* connected group: 2 px apart, round ends, small inner corners */
.seg { display: flex; gap: 2px; max-width: 100%; width: 100%; }
.opt {
  flex: 1 1 auto; min-height: 40px; padding: 0 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  white-space: nowrap; min-width: max-content; text-align: center;
  background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); font-weight: 600;
  border-radius: var(--md-sys-shape-corner-extra-small);
}
.opt:first-child { border-radius: var(--md-sys-shape-corner-full) var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-full); }
.opt:last-child { border-radius: var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-full) var(--md-sys-shape-corner-full) var(--md-sys-shape-corner-extra-small); }
.opt.on { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.opt:disabled { opacity: 0.38; cursor: default; }
.chk { width: 18px; height: 18px; }
.lbl { display: inline-flex; align-items: center; gap: 6px; }
.stacked { flex-direction: column; }
.stacked .opt { flex: none; min-height: 48px; min-width: 0; justify-content: flex-start; padding: 0 20px; white-space: normal; }
.stacked .opt:first-child { border-radius: var(--md-sys-shape-corner-large) var(--md-sys-shape-corner-large) var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-extra-small); }
.stacked .opt:last-child { border-radius: var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-large) var(--md-sys-shape-corner-large); }
</style>
