<script setup lang="ts">
import { vRipple } from '@/lib/ripple';

withDefaults(defineProps<{
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Makes the button a link that opens in a new tab. */
  href?: string;
}>(), { variant: 'filled', type: 'button' });
</script>

<template>
  <component
    :is="href ? 'a' : 'button'" v-ripple class="m3-btn" :class="variant"
    v-bind="href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { type, disabled }"
  >
    <span v-if="$slots.icon" class="ico" aria-hidden="true"><slot name="icon" /></span>
    <slot />
  </component>
</template>

<style scoped>
.m3-btn {
  min-height: 44px; min-width: 44px; padding: 0 24px; border-radius: var(--md-sys-shape-corner-full);
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font: var(--md-sys-typescale-label-large); letter-spacing: 0.1px; white-space: nowrap; text-decoration: none;
  transition: border-radius var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring), transform var(--md-sys-motion-duration-short);
}
.m3-btn:active:not(:disabled) { border-radius: var(--md-sys-shape-corner-medium); transform: scale(0.97); }
.filled { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.tonal { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.outlined { border: 1px solid var(--md-sys-color-outline); color: var(--md-sys-color-primary); }
.text { color: var(--md-sys-color-primary); padding: 0 12px; }
.m3-btn:disabled { opacity: 0.38; cursor: default; }
.ico { display: inline-flex; margin-left: -8px; }
.ico :deep(svg) { width: 18px; height: 18px; }
</style>
