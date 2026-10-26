<script setup lang="ts">
/**
 * The small static map of an event's picked place (feature event-location): OpenStreetMap pictures centred on the place
 * at zoom 16 with a pin and the "© OpenStreetMap" credit on the map. No panning or zooming and no map library (A4).
 *
 * Only the pictures that show inside the box are loaded (the tile policy forbids fetching pictures nobody sees). They
 * come straight from the configured tile server, or offline from the service worker's cache of pictures shown before;
 * when one cannot be had, a placeholder with the pin and the place's name stands in (R7), never an error.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Place } from '@/api/types';
import { IconLocationOn } from '@/components/icons';
import { t } from '@/i18n';
import { tileLayout, tileSrc } from './place';

const props = defineProps<{ place: Place; tileUrl: string }>();

/** Zoom level of the map (streets and buildings readable, R6). */
const ZOOM = 16;
/** Map height in px (R6). */
const HEIGHT = 140;
/** Width until the box has been measured: a phone sheet's field width. */
const FALLBACK_WIDTH = 358;

const root = ref<HTMLElement | null>(null);
const width = ref(FALLBACK_WIDTH);
const loaded = ref(new Set<string>());
const failed = ref(false);

const tiles = computed(() => tileLayout(props.place.lat, props.place.lon, ZOOM, width.value, HEIGHT)
  .map((p) => ({ ...p, src: tileSrc(props.tileUrl, ZOOM, p.x, p.y) })));
const usable = computed(() => !!props.tileUrl && !failed.value);

// a newly picked place gets a fresh try
watch(() => [props.place.lat, props.place.lon, props.tileUrl], () => { failed.value = false; loaded.value = new Set(); });

let observer: ResizeObserver | null = null;
/** Takes the box's real width, so exactly the visible pictures are loaded. */
function measure(): void {
  const w = root.value?.clientWidth ?? 0;
  if (w > 0) width.value = w;
}
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(measure);
    observer.observe(root.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

function onLoad(src: string): void {
  loaded.value = new Set(loaded.value).add(src);
}
</script>

<template>
  <div ref="root" class="map-box">
    <div
      v-if="usable" class="map" role="img" :aria-label="t('calendar.event.place.map', { name: place.name })" data-testid="event-map"
      :data-lat="place.lat.toFixed(4)" :data-lon="place.lon.toFixed(4)"
    >
      <img
        v-for="p in tiles" :key="p.src" :src="p.src" alt="" crossorigin="anonymous" draggable="false" class="tile"
        :style="{ left: `${p.left}px`, top: `${p.top}px` }" :data-loaded="loaded.has(p.src)" @load="onLoad(p.src)" @error="failed = true"
      >
      <IconLocationOn class="pin" aria-hidden="true" data-testid="event-map-pin" />
      <span class="credit" data-testid="event-map-credit">{{ t('calendar.event.place.credit') }}</span>
    </div>
    <div v-else class="ph" data-testid="event-map-placeholder">
      <IconLocationOn class="ph-pin" aria-hidden="true" data-testid="event-map-pin" />
      <span class="ph-name">{{ place.name }}</span>
      <span class="ph-note">{{ t('calendar.event.place.offline') }}</span>
    </div>
  </div>
</template>

<style scoped>
.map-box { height: 140px; flex: none; }
/* the pictures are OpenStreetMap's own look; the box takes the app's field corners */
.map { position: relative; height: 100%; overflow: hidden; border-radius: var(--md-sys-shape-corner-small); background: #f2efe9; }
.tile { position: absolute; width: 256px; height: 256px; max-width: none; user-select: none; pointer-events: none; }
/* the pin's tip marks the place: the icon's tip is at its bottom centre */
.pin { position: absolute; left: 50%; top: 50%; width: 36px; height: 36px; transform: translate(-50%, -88%); color: var(--md-sys-color-primary); filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.35)); }
/* OSM credit: on the map, never covered (OSMF attribution guideline) */
.credit { position: absolute; right: 0; bottom: 0; z-index: 1; padding: 1px 6px; background: rgb(255 255 255 / 0.85); color: #333; font: var(--md-sys-typescale-label-small); font-weight: 400; border-top-left-radius: 6px; }
.ph { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0 16px; text-align: center; border-radius: var(--md-sys-shape-corner-small); background: var(--md-sys-color-surface-container-highest); border: 1px dashed var(--md-sys-color-outline); }
.ph-pin { width: 32px; height: 32px; color: var(--md-sys-color-primary); }
.ph-name { font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface); }
.ph-note { font: var(--md-sys-typescale-label-medium); font-weight: 400; color: var(--md-sys-color-on-surface-variant); }
</style>
