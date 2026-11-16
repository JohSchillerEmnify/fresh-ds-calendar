<script setup lang="ts">
/** The "custom colour" swatch of a colour row: a hue-wheel dot over the platform's own colour picker (the custom-colour
 * entry), filled with the colour once one is chosen (`selected`). `live` emits on every drag step, else on the final choice. */
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ modelValue: string | null; label: string; selected?: boolean; live?: boolean; size?: number }>(), { size: 36 });
const emit = defineEmits<{ 'update:modelValue': [v: string] }>();
const read = (e: Event) => (e.target as HTMLInputElement).value.toLowerCase();
</script>

<template>
  <label class="cc" :class="{ 'is-selected': selected }" :style="{ '--cc': modelValue ?? 'transparent', '--cc-size': size + 'px' }" :title="label">
    <input v-bind="$attrs" type="color" :value="modelValue ?? '#000000'" :aria-label="label" @input="live && emit('update:modelValue', read($event))" @change="!live && emit('update:modelValue', read($event))" />
  </label>
</template>

<style scoped>
.cc { position: relative; flex: none; width: var(--cc-size); height: var(--cc-size); border-radius: 50%; overflow: hidden; cursor: pointer; background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12); }
.cc.is-selected { background: var(--cc); box-shadow: 0 0 0 2px var(--md-sys-color-primary); }
.cc:has(input:focus-visible) { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
.cc input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
</style>
