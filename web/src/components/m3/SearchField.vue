<script setup lang="ts">
/** The M3 search bar: a full-round 56 px bar with a search icon, the text and, when `clearLabel` is given, a clear button once there is text. */
import IconButton from '@/components/m3/IconButton.vue';
import { IconClose, IconSearch } from '@/components/icons';

defineOptions({ inheritAttrs: false });
defineProps<{
  modelValue: string; label: string; clearLabel?: string;
  /** data-testid of the bar; other attributes go to the input. */
  barTestid?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [v: string] }>();
</script>

<template>
  <label class="search" :class="$attrs.class" :data-testid="barTestid">
    <IconSearch class="glass" aria-hidden="true" />
    <input
      v-bind="{ ...$attrs, class: undefined }" class="in" type="search" :value="modelValue" :placeholder="label" :aria-label="label"
      autocomplete="off" enterkeyhint="search" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <IconButton v-if="clearLabel && modelValue" :label="clearLabel" data-testid="search-clear" @click="emit('update:modelValue', '')"><IconClose /></IconButton>
  </label>
</template>

<style scoped>
/* search bar (M3 specs: container 56 px, full shape, surface-container-high; not in material-web, so unverified against its tokens) */
.search {
  display: flex; align-items: center; gap: 4px; box-sizing: border-box; min-height: 56px; padding: 0 4px 0 20px; border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant);
}
.search:focus-within { outline: 2px solid var(--md-sys-color-primary); }
.glass { width: 24px; height: 24px; flex: none; }
.in { flex: 1; min-width: 0; height: 48px; border: 0; outline: 0; background: transparent; color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-body-large); padding: 0 8px; }
.in::-webkit-search-cancel-button { display: none; }
</style>
