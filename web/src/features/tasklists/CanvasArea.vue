<script setup lang="ts">
/**
 * One area on the Canvas (ARCHITECTURE "Canvas"): a named, coloured rectangle drawn under the notes. Only its header and
 * its resize handle take the pointer (move, tap to edit, resize); the rest lets the canvas pan through. Membership of
 * notes is by position and drawn nowhere.
 */
import { computed } from 'vue';
import { t } from '@/i18n';
import type { CanvasArea } from '@/api/types';

const props = defineProps<{ area: CanvasArea; x: number; y: number; w: number; h: number; z: number; editing: boolean; dragging: boolean }>();
const emit = defineEmits<{ edit: [] }>();

const style = computed(() => ({ transform: `translate3d(${props.x}px, ${props.y}px, 0)`, width: `${props.w}px`, height: `${props.h}px`, zIndex: props.z, '--c': props.area.color }));
</script>

<template>
  <section
    class="area" data-testid="canvas-area" :data-area-id="area.id" :data-name="area.name" :data-color="area.color" :data-x="Math.round(x)" :data-y="Math.round(y)"
    :data-w="Math.round(w)" :data-h="Math.round(h)" :data-editing="editing || undefined" :data-dragging="dragging || undefined" :style="style"
  >
    <header
      class="head" data-testid="canvas-area-header" data-canvas-drag="area-head" :data-canvas-id="area.id" role="button" tabindex="0"
      :aria-label="t('canvas.area.edit', { name: area.name })" @keydown.enter.prevent="emit('edit')" @keydown.space.prevent="emit('edit')"
    >
      <span class="name">{{ area.name }}</span>
    </header>
    <span class="resize" data-testid="canvas-area-resize" data-canvas-drag="area-resize" :data-canvas-id="area.id" role="presentation" :title="t('canvas.area.resize', { name: area.name })" />
  </section>
</template>

<style scoped>
.area {
  position: absolute; left: 0; top: 0; box-sizing: border-box; pointer-events: none; border: 2px dashed var(--c); border-radius: 16px;
  background: color-mix(in srgb, var(--c) 12%, transparent);
}
.area[data-editing] { border-style: solid; }
.head {
  pointer-events: auto; cursor: grab; display: flex; align-items: center; height: 40px; padding: 0 14px; border-radius: 14px 14px 0 0;
  background: color-mix(in srgb, var(--c) 28%, transparent); font: var(--md-sys-typescale-title-small); user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.head:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: -2px; }
.area[data-dragging] .head { cursor: grabbing; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resize {
  pointer-events: auto; position: absolute; right: 0; bottom: 0; width: 32px; height: 32px; cursor: nwse-resize; border-radius: 0 0 14px 0;
  background: linear-gradient(135deg, transparent 55%, var(--c) 55% 62%, transparent 62% 72%, var(--c) 72% 79%, transparent 79%);
}
</style>
