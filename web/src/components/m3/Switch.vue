<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [v: boolean] }>();
</script>

<template>
  <button class="switch" type="button" role="switch" :aria-checked="modelValue" :aria-label="label" :disabled="disabled" :class="{ on: modelValue }" @click="$emit('update:modelValue', !modelValue)">
    <span class="track"><span class="thumb" /></span>
  </button>
</template>

<style scoped>
.switch { width: 60px; height: 44px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.track {
  position: relative; width: 52px; height: 32px; border-radius: var(--md-sys-shape-corner-full); border: 2px solid var(--md-sys-color-outline);
  background: var(--md-sys-color-surface-container-highest); transition: background var(--md-sys-motion-duration-short);
}
.thumb {
  position: absolute; top: 50%; left: 6px; width: 16px; height: 16px; margin-top: -8px; border-radius: 50%; background: var(--md-sys-color-outline);
  transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring), width var(--md-sys-motion-duration-short), height var(--md-sys-motion-duration-short), background var(--md-sys-motion-duration-short);
}
.on .track { background: var(--md-sys-color-primary); border-color: var(--md-sys-color-primary); }
.on .thumb { width: 24px; height: 24px; margin-top: -12px; background: var(--md-sys-color-on-primary); transform: translateX(18px); left: 4px; }
.switch:disabled { opacity: 0.38; }
.switch:active .thumb { width: 28px; }
</style>
