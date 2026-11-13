<script setup lang="ts">
/** The M3 list item (_md-comp-list, material-web tokens v0.192): leading, headline (default), supporting and trailing
 * slots; one line at least 56 px at Comfortable (moved by the density shift, never under 48), 16 px padding and gaps. `tag` sets the element;
 * `interactive` makes it a tappable row (pointer, hover state), `selected` is the highlighted choice. */
defineProps<{ tag?: string; interactive?: boolean; selected?: boolean }>();
</script>

<template>
  <component :is="tag ?? 'div'" class="li" :class="{ act: interactive, sel: selected }">
    <span v-if="$slots.leading" class="li-lead"><slot name="leading" /></span>
    <span class="li-body"><slot /><span v-if="$slots.supporting" class="li-sup"><slot name="supporting" /></span></span>
    <span v-if="$slots.trailing" class="li-trail"><slot name="trailing" /></span>
  </component>
</template>

<style scoped>
.li {
  --h: max(48px, calc(56px + var(--md-density-shift)));
  display: flex; align-items: center; gap: 16px; min-height: var(--h); padding: 0 16px;
  color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-body-large);
}
.li.act { cursor: pointer; }
@media (hover: hover) { .li.act:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); } }
.li.sel { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.li-lead, .li-trail { flex: none; display: inline-flex; align-items: center; min-width: 24px; color: var(--md-sys-color-on-surface-variant); }
.li-lead :deep(svg), .li-trail :deep(svg) { width: 24px; height: 24px; }
.li-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-self: stretch; }
.li-sup { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
