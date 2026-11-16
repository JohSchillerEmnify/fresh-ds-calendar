<script setup lang="ts">
import Checkbox from '@/components/m3/Checkbox.vue';

/**
 * The kit checkbox with a text label that strikes through left to right when ticked (theme preview, motion lab).
 * `change` / `update:modelValue` are emitted synchronously; the reward plays in the kit checkbox.
 */
defineProps<{ modelValue: boolean; label?: string; disabled?: boolean; id?: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; change: [v: boolean] }>();
</script>

<template>
  <label class="rcb" :class="{ 'is-checked': modelValue, 'is-disabled': disabled }" data-testid="reward-checkbox">
    <Checkbox :id="id" :model-value="modelValue" :disabled="disabled" @update:model-value="emit('update:modelValue', $event)" @change="emit('change', $event)" />
    <span v-if="label !== undefined || $slots.default" class="rcb-label"><slot>{{ label }}</slot></span>
  </label>
</template>

<style scoped>
.rcb { display: inline-flex; align-items: center; cursor: pointer; position: relative; -webkit-tap-highlight-color: transparent; }
.rcb-label { background: linear-gradient(currentColor, currentColor) no-repeat 0 58% / 0% 1.6px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.is-checked .rcb-label { background-size: 100% 1.6px; opacity: 0.6; }
html[data-motion='full'] .rcb-label { transition: background-size 280ms cubic-bezier(0.3, 0, 0.2, 1) 60ms, opacity 240ms ease-out 60ms; }
.is-disabled { cursor: default; }
</style>
