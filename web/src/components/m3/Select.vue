<script setup lang="ts" generic="T extends string">
import { computed, useAttrs, useId } from 'vue';
import IconExpand from '~icons/material-symbols/expand-more';
import type { Option } from './types';

defineOptions({ inheritAttrs: false });
defineProps<{ modelValue: T; options: Option<T>[]; label: string }>();
defineEmits<{ 'update:modelValue': [v: T] }>();
const id = useId();
const attrs = useAttrs();
const rest = computed(() => { const { class: _c, style: _s, ...r } = attrs; return r; });
</script>

<template>
  <div class="sel" :class="$attrs.class" :style="$attrs.style as never">
    <select :id="id" v-bind="rest" class="in" :value="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as T)">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <label class="lbl" :for="id">{{ label }}</label>
    <IconExpand class="chev" aria-hidden="true" />
  </div>
</template>

<style scoped>
.sel { position: relative; background: var(--md-sys-color-surface-container-highest); border-radius: var(--md-sys-shape-corner-small) var(--md-sys-shape-corner-small) 0 0; border-bottom: 1px solid var(--md-sys-color-on-surface-variant); }
.sel:focus-within { border-bottom: 2px solid var(--md-sys-color-primary); margin-bottom: -1px; }
.in { width: 100%; min-height: 56px; appearance: none; background: transparent; border: 0; outline: 0; padding: 24px 40px 6px 16px; font-size: 16px; color: var(--md-sys-color-on-surface); border-radius: inherit; }
.lbl { position: absolute; left: 16px; top: 8px; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); pointer-events: none; }
.chev { position: absolute; right: 12px; top: 16px; width: 24px; height: 24px; pointer-events: none; color: var(--md-sys-color-on-surface-variant); }
.in option { color: initial; }
</style>
