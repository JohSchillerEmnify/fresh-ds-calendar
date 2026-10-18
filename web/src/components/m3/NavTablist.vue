<script setup lang="ts">
/** The shared tab button loop of the view switcher (bar, rail, tabs); each wrapper styles it via `:deep`. `pill` adds the icon pill. */
import type { NavItem } from './types';
import { vRipple } from '@/lib/ripple';

defineProps<{ items: NavItem[]; modelValue: string; pill?: boolean }>();
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <div class="tabs" role="tablist">
    <button
      v-for="it in items" :key="it.id" v-ripple class="dest" role="tab" type="button"
      :aria-selected="it.id === modelValue" :class="{ active: it.id === modelValue }" :data-testid="it.testid" :data-experimental="it.experimental ? 'true' : undefined"
      @click="$emit('update:modelValue', it.id)"
    >
      <span v-if="pill" class="pill"><component :is="it.icon" /></span>
      <span class="lbl">{{ it.label }}</span>
    </button>
  </div>
</template>
