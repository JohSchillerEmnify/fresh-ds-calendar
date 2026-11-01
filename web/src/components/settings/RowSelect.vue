<script setup lang="ts" generic="T extends string">
/** The menu at the end of a settings row: the chosen option and a chevron over a native select, so every platform shows its own picker. */
import { IconExpandMore as IconExpand } from '@/components/icons';
import type { Option } from '@/components/m3/types';

defineOptions({ inheritAttrs: false });
defineProps<{ modelValue: T; options: Option<T>[]; label: string }>();
defineEmits<{ 'update:modelValue': [v: T] }>();
</script>

<template>
  <span class="menu">
    <select v-bind="$attrs" class="in" :value="modelValue" :aria-label="label" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as T)">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <IconExpand class="chev" aria-hidden="true" />
  </span>
</template>

<style scoped>
.menu { position: relative; display: inline-flex; align-items: center; max-width: 100%; border-radius: var(--md-sys-shape-corner-small); }
.menu:focus-within { outline: 2px solid var(--md-sys-color-primary); }
.in {
  appearance: none; background: transparent; border: 0; outline: 0; min-height: 44px; max-width: 100%; padding: 0 32px 0 8px;
  font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-primary); text-align: right; text-overflow: ellipsis; cursor: pointer;
}
.in option { color: var(--md-sys-color-on-surface); background: var(--md-sys-color-surface-container); }
.chev { position: absolute; right: 4px; width: 24px; height: 24px; pointer-events: none; color: var(--md-sys-color-primary); }
</style>
