<script setup lang="ts">
/**
 * One area on the Canvas (feature tasks-canvas): a named, coloured rectangle drawn under the notes. A long press anywhere
 * on it (or a mouse drag on its header) moves it, a tap on the header edits it; the body pans the canvas for a mouse and a
 * finger that moves at once. After a long press without moving (or a click) four 44 px handles on the corners resize it,
 * the calendar's resize-handle pattern. Membership of notes is by position and drawn nowhere.
 */
import { computed } from 'vue';
import Pressable from '@/components/m3/Pressable.vue';
import { t } from '@/i18n';
import type { CanvasArea } from '@/api/types';

const props = defineProps<{ area: CanvasArea; x: number; y: number; w: number; h: number; z: number; editing: boolean; dragging: boolean; selected: boolean }>();
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;
const emit = defineEmits<{ edit: [] }>();

const style = computed(() => ({ transform: `translate3d(${props.x}px, ${props.y}px, 0)`, width: `${props.w}px`, height: `${props.h}px`, zIndex: props.z, '--c': props.area.color }));
</script>

<template>
  <section
    class="area" data-testid="canvas-area" data-canvas-drag="area-body" :data-canvas-id="area.id" :data-area-id="area.id" :data-name="area.name" :data-color="area.color" :data-x="Math.round(x)" :data-y="Math.round(y)"
    :data-w="Math.round(w)" :data-h="Math.round(h)" :data-editing="editing || undefined" :data-selected="selected || undefined" :data-dragging="dragging || undefined" :style="style"
  >
    <Pressable
      class="head" data-testid="canvas-area-header" data-canvas-drag="area-head" :data-canvas-id="area.id"
      :aria-label="t('canvas.area.edit', { name: area.name })" @keydown.enter.prevent="emit('edit')" @keydown.space.prevent="emit('edit')"
    >
      <span class="name">{{ area.name }}</span>
    </Pressable>
    <template v-if="selected">
      <span
        v-for="c in CORNERS" :key="c" class="rh" :class="c" data-testid="canvas-area-handle" data-canvas-drag="area-resize" :data-canvas-id="area.id"
        :data-canvas-corner="c" :data-corner="c" aria-hidden="true"
      />
    </template>
  </section>
</template>

<style scoped>
.area {
  position: absolute; left: 0; top: 0; box-sizing: border-box; border: 2px dashed var(--c); border-radius: 16px;
  background: color-mix(in srgb, var(--c) 12%, transparent); -webkit-touch-callout: none; user-select: none; -webkit-user-select: none;
}
.area[data-editing], .area[data-selected] { border-style: solid; }
.head {
  cursor: grab; display: flex; align-items: center; width: 100%; text-align: left; height: 40px; padding: 0 14px; border-radius: 14px 14px 0 0;
  background: color-mix(in srgb, var(--c) 28%, transparent); font: var(--md-sys-typescale-title-small);
}
.head:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: -2px; }
.area[data-dragging] .head { cursor: grabbing; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 44 px touch targets centred on the corners; the pill is the visible part */
.rh { position: absolute; width: 44px; height: 44px; margin: -22px; z-index: 6; touch-action: none; }
.rh.nw { left: 0; top: 0; cursor: nwse-resize; }
.rh.ne { left: 100%; top: 0; cursor: nesw-resize; }
.rh.sw { left: 0; top: 100%; cursor: nesw-resize; }
.rh.se { left: 100%; top: 100%; cursor: nwse-resize; }
.rh::after {
  content: ''; position: absolute; left: 13px; top: 13px; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%;
  background: var(--md-sys-color-primary); border: 2px solid var(--md-sys-color-surface); box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
}
</style>
