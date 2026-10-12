<script setup lang="ts">
import { computed } from 'vue';
import { itemRenderers, openItem, type ItemVariant } from '@/extensions/registry';
import type { Segment } from '@/lib/items';
import BasicItem from './BasicItem.vue';

/** Renders one segment with the registered renderer for its kind (or the basic one). */
const props = defineProps<{ segment: Segment; variant: ItemVariant; height?: number }>();
const comp = computed(() => itemRenderers[props.segment.item.kind] ?? BasicItem);
</script>

<template>
  <component :is="comp" :segment="segment" :variant="variant" :height="height" @open="openItem(segment.item)" />
</template>
