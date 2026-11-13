<script setup lang="ts">
/** The M3 radio button (_md-comp-radio-button, material-web tokens v0.192): 20 px ring (2 px), 10 px dot, 40 px state
 * layer, 48 px target. A native radio (arrows, grouping by `name`) under the drawing; `modelValue` is the group's value. */
const props = defineProps<{ modelValue: string | null; value: string; name: string; label?: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [v: string] }>();
</script>

<template>
  <span class="rb" :class="{ 'is-checked': modelValue === value, 'is-disabled': disabled }">
    <span class="rb-layer" aria-hidden="true" />
    <span class="rb-ring" aria-hidden="true"><span class="rb-dot" /></span>
    <input class="rb-in" type="radio" :name="name" :value="value" :checked="modelValue === value" :disabled="disabled" :aria-label="label" @change="emit('update:modelValue', props.value)" />
  </span>
</template>

<style scoped>
.rb { position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; color: var(--md-sys-color-on-surface); -webkit-tap-highlight-color: transparent; }
.rb.is-checked { color: var(--md-sys-color-primary); }
.rb-layer { position: absolute; width: 40px; height: 40px; border-radius: var(--md-sys-shape-corner-full); background: currentColor; opacity: 0; pointer-events: none; transition: opacity var(--md-sys-motion-duration-short); }
@media (hover: hover) { .rb:hover:not(.is-disabled) .rb-layer { opacity: 0.08; } }
.rb:has(.rb-in:focus-visible) .rb-layer, .rb:active:not(.is-disabled) .rb-layer { opacity: 0.1; }
.rb-ring { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 2px solid var(--md-sys-color-on-surface-variant); border-radius: var(--md-sys-shape-corner-full); pointer-events: none; }
.is-checked .rb-ring { border-color: var(--md-sys-color-primary); }
.rb-dot { width: 10px; height: 10px; border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-primary); transform: scale(0); transition: transform var(--md-sys-motion-duration-short); }
.is-checked .rb-dot { transform: scale(1); }
/* the whole 48 px square takes the tap */
.rb-in { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.rb-in:focus-visible { outline: 0; }
.is-disabled { opacity: 0.38; }
.is-disabled .rb-in { cursor: default; }
</style>
