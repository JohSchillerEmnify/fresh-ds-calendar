<script setup lang="ts">
/** The M3 list item (_md-comp-list, material-web tokens v0.192): leading, headline (default), supporting and trailing
 * slots; one line at least 56 px (density-scaled, never under 48), 16 px padding and gaps. `tag` sets the element. */
defineProps<{ tag?: string }>();
</script>

<template>
  <component :is="tag ?? 'div'" class="li">
    <span v-if="$slots.leading" class="li-lead"><slot name="leading" /></span>
    <span class="li-body"><slot /><span v-if="$slots.supporting" class="li-sup"><slot name="supporting" /></span></span>
    <span v-if="$slots.trailing" class="li-trail"><slot name="trailing" /></span>
  </component>
</template>

<style scoped>
.li {
  display: flex; align-items: center; gap: 16px; min-height: max(48px, calc(56px * var(--dz, 1))); padding: 0 16px;
  color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-body-large);
}
.li-lead, .li-trail { flex: none; display: inline-flex; align-items: center; min-width: 24px; color: var(--md-sys-color-on-surface-variant); }
.li-lead :deep(svg), .li-trail :deep(svg) { width: 24px; height: 24px; }
.li-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-self: stretch; }
.li-sup { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
