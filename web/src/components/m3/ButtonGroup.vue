<script setup lang="ts">
/** A connected button group of actions: the buttons touch (2 px apart), the ends are round, the inner corners small. */
defineProps<{ label: string }>();
</script>

<template>
  <div class="grp" role="group" :aria-label="label"><slot /></div>
</template>

<style scoped>
.grp { display: flex; gap: 2px; max-width: 100%; }
/* the radius is drawn outside the button's transparent tap border (4 px wide, --tap high), so the drawn inner corners are extra-small */
.grp :slotted(.m3-btn) {
  --in: calc(var(--md-sys-shape-corner-extra-small) + 4px) calc(var(--md-sys-shape-corner-extra-small) + var(--tap)); --out: var(--md-sys-shape-corner-full);
  flex: 1 1 auto; min-width: 0; padding: 0 16px;
  border-top-left-radius: var(--in); border-top-right-radius: var(--in); border-bottom-right-radius: var(--in); border-bottom-left-radius: var(--in);
}
.grp :slotted(.m3-btn:first-child) { border-top-left-radius: var(--out); border-bottom-left-radius: var(--out); }
.grp :slotted(.m3-btn:last-child) { border-top-right-radius: var(--out); border-bottom-right-radius: var(--out); }
</style>
