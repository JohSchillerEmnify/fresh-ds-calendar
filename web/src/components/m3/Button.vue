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
/* 40 px drawn (_md-comp-filled-button container-height) in a 48 px tap area (material-web button touch target); the border
   is tappable but transparent and its sides are given back by the margin; extra-large corners keep it round up to 56 px */
.m3-btn {
  min-height: 48px; min-width: 48px; padding: 0 24px; border: 4px solid transparent; margin-inline: -4px; background-clip: padding-box; border-radius: var(--md-sys-shape-corner-extra-large);
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font: var(--md-sys-typescale-label-large); letter-spacing: 0.1px; white-space: nowrap; text-decoration: none;
  transition: border-radius var(--md-sys-motion-duration-short) var(--md-sys-motion-spring), transform var(--md-sys-motion-duration-short) var(--md-sys-motion-spring);
}
.m3-btn:active:not(:disabled) { border-radius: var(--md-sys-shape-corner-medium); transform: scale(0.97); }
.filled { background-color: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.tonal { background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.outlined { box-shadow: inset 0 0 0 1px var(--md-sys-color-outline); color: var(--md-sys-color-primary); }
.text { color: var(--md-sys-color-primary); padding: 0 12px; }
.m3-btn:disabled { opacity: 0.38; cursor: default; }
.ico { display: inline-flex; margin-left: -8px; }
@media (prefers-reduced-motion: reduce) { .m3-btn:active:not(:disabled) { border-radius: var(--md-sys-shape-corner-extra-large); } }
.ico :deep(svg) { width: 18px; height: 18px; }
</style>
