<script setup lang="ts">
/** The full-screen map picker: a Leaflet map under a fixed pin (address from the place search once it rests); offline it says so, and Leaflet loads only when the map shows. */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Map as LeafletMap } from 'leaflet';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import { IconClose, IconCloudOff, IconLocationOn, IconMyLocation, IconSearch } from '@/components/icons';
import { language, t } from '@/i18n';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { currentPosition } from '@/native/location';
import { createResolver, formatCoords } from './mapPicker';
import { photonLang, searchPlaces, type PlacePick } from './place';

const props = defineProps<{ start: { lat: number; lon: number } | null; tileUrl: string; searchUrl: string }>();
const emit = defineEmits<{ use: [p: PlacePick]; cancel: []; type: [] }>();

/** Where the map opens without a place: all of Germany. The first move or search puts the pin on a place. */
const DEFAULT_VIEW = { lat: 51.16, lon: 10.45, zoom: 6 };
/** Street level: a place found by search, the device's position or the event's place. */
const PLACE_ZOOM = 17;
/** The pause after the last key before the search is asked. */
const SEARCH_PAUSE_MS = 250;
/** Typed characters before the search is asked. */
const MIN_CHARS = 3;

const offline = navigator.onLine === false || !props.tileUrl;
const mapEl = ref<HTMLElement | null>(null);
const centre = ref(props.start ?? DEFAULT_VIEW);
/** False until a place was chosen on purpose (the first move, search or position): "Use this place" waits for it. */
const chosen = ref(!!props.start);
const address = ref<string | null>(null);
const state = ref<'idle' | 'pending' | 'failed'>('idle');
const note = ref<'' | 'locating' | 'denied' | 'unavailable'>('');
const query = ref('');
const hits = ref<PlacePick[]>([]);
let map: LeafletMap | null = null;

const label = computed(() => address.value ?? formatCoords(centre.value.lat, centre.value.lon));
const canUse = computed(() => chosen.value && state.value === 'idle');

const resolver = createResolver(props.searchUrl, photonLang(language.value), {
  onPending: () => { state.value = 'pending'; },
  onAddress: (a) => { address.value = a; state.value = 'idle'; },
  // no address to offer: the position itself is the place's name
  onFail: () => { address.value = null; state.value = 'idle'; },
});

useOverlayHistory(() => true, () => emit('cancel'));

onMounted(async () => {
  if (offline || !mapEl.value) return;
  const [L] = await Promise.all([import('leaflet').then((m) => m.default), import('leaflet/dist/leaflet.css')]);
  if (!mapEl.value) return;
  map = L.map(mapEl.value, { zoomControl: false, attributionControl: false, center: [centre.value.lat, centre.value.lon], zoom: props.start ? PLACE_ZOOM : DEFAULT_VIEW.zoom });
  L.tileLayer(props.tileUrl, { maxZoom: 19, crossOrigin: 'anonymous' }).addTo(map);
  map.on('moveend', () => {
    const c = map!.getCenter();
    centre.value = { lat: c.lat, lon: c.lng };
    chosen.value = true;
    resolver.request(c.lat, c.lng);
  });
  if (props.start) resolver.request(props.start.lat, props.start.lon);
});

onBeforeUnmount(() => { resolver.cancel(); clearTimeout(searchTimer); map?.remove(); map = null; });

/** Moves the map (and so the pin) to a position. */
function goTo(lat: number, lon: number): void {
  map?.setView([lat, lon], PLACE_ZOOM, { animate: false });
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchCtl: AbortController | null = null;
/** Asks the place search for the typed text after a pause; only the newest answer is shown. */
function onSearch(v: string): void {
  query.value = v;
  clearTimeout(searchTimer);
  searchCtl?.abort();
  if (v.trim().length < MIN_CHARS) { hits.value = []; return; }
  searchTimer = setTimeout(async () => {
    const ctl = searchCtl = new AbortController();
    try {
      const found = await searchPlaces(props.searchUrl, v.trim(), photonLang(language.value), ctl.signal);
      if (searchCtl === ctl) hits.value = found;
    } catch {
      if (searchCtl === ctl) hits.value = [];
    }
  }, SEARCH_PAUSE_MS);
}

/** Takes a found place: the map moves there and the list closes. */
function pickHit(h: PlacePick): void {
  hits.value = [];
  query.value = '';
  goTo(h.lat, h.lon);
}

/** "Use my location": the device is asked now (the first tap), never before. */
async function locate(): Promise<void> {
  note.value = 'locating';
  const r = await currentPosition();
  if (r.ok) { note.value = ''; goTo(r.lat, r.lon); } else note.value = r.reason;
}

/** The pin's position and address become the event's place. */
function use(): void {
  emit('use', { name: label.value, address: '', lat: centre.value.lat, lon: centre.value.lon });
}
</script>

<template>
  <Teleport to="body">
    <div class="picker" role="dialog" aria-modal="true" :aria-label="t('calendar.event.place.picker.title')" data-testid="map-picker" @keydown.esc.stop.prevent="emit('cancel')">
      <header class="bar">
        <IconButton :label="t('calendar.event.place.picker.close')" data-testid="map-picker-close" @click="emit('cancel')"><IconClose /></IconButton>
        <h2 class="title">{{ t('calendar.event.place.picker.title') }}</h2>
      </header>

      <div v-if="offline" class="off" data-testid="map-picker-offline">
        <span class="off-ico"><IconCloudOff aria-hidden="true" /></span>
        <h3 class="off-title">{{ t('calendar.event.place.picker.offlineTitle') }}</h3>
        <p class="off-text">{{ t('calendar.event.place.picker.offlineText') }}</p>
        <Button data-testid="map-picker-type" @click="emit('type')">{{ t('calendar.event.place.picker.typeInstead') }}</Button>
        <Button variant="text" data-testid="map-picker-cancel" @click="emit('cancel')">{{ t('calendar.event.place.picker.cancel') }}</Button>
      </div>

      <template v-else>
        <div class="stage">
          <div ref="mapEl" class="map" role="img" :aria-label="t('calendar.event.place.picker.map')" data-testid="map-picker-map" :data-lat="centre.lat.toFixed(4)" :data-lon="centre.lon.toFixed(4)" />
          <div class="search">
            <IconSearch class="s-ico" aria-hidden="true" />
            <input
              class="s-in" type="search" :value="query" :placeholder="t('calendar.event.place.picker.search')" :aria-label="t('calendar.event.place.picker.search')"
              autocomplete="off" enterkeyhint="search" data-testid="map-picker-search" @input="onSearch(($event.target as HTMLInputElement).value)"
            >
          </div>
          <div v-if="hits.length" class="hits" role="listbox" :aria-label="t('calendar.event.place.picker.results')" data-testid="map-picker-results">
            <div v-for="h in hits" :key="`${h.lat},${h.lon},${h.name}`" class="hit" role="option" aria-selected="false" data-testid="map-picker-result" @click="pickHit(h)">
              <IconLocationOn class="h-ico" aria-hidden="true" />
              <span class="h-txt"><span class="h-name" data-testid="map-picker-result-name">{{ h.name }}</span><span v-if="h.address" class="h-sub">{{ h.address }}</span></span>
            </div>
          </div>
          <IconLocationOn class="pin" aria-hidden="true" data-testid="map-picker-pin" />
          <span class="shadow" aria-hidden="true" />
          <Button variant="tonal" class="locate" data-testid="map-picker-locate" @click="locate"><template #icon><IconMyLocation /></template>{{ t('calendar.event.place.picker.locate') }}</Button>
          <p v-if="note" class="note" role="status" data-testid="map-picker-locate-note" :data-note="note">{{ t(`calendar.event.place.picker.${note}`) }}</p>
          <span class="credit" data-testid="map-picker-credit">{{ t('calendar.event.place.picker.credit') }}</span>
        </div>
        <section class="panel">
          <p class="sel">{{ t('calendar.event.place.picker.selected') }}</p>
          <p class="addr" data-testid="map-picker-address">{{ !chosen ? t('calendar.event.place.picker.moveHint') : state === 'pending' ? t('calendar.event.place.picker.resolving') : label }}</p>
          <p class="coords" data-testid="map-picker-coords">{{ chosen ? formatCoords(centre.lat, centre.lon) : '' }}&nbsp;</p>
          <div class="actions">
            <Button variant="text" data-testid="map-picker-cancel" @click="emit('cancel')">{{ t('calendar.event.place.picker.cancel') }}</Button>
            <Button :disabled="!canUse" data-testid="map-picker-use" @click="use">{{ t('calendar.event.place.picker.use') }}</Button>
          </div>
        </section>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.picker { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }
.bar { flex: none; height: 56px; display: flex; align-items: center; gap: 8px; padding: 0 4px; padding-top: var(--safe-top, 0px); box-sizing: content-box; }
.title { margin: 0; font: var(--md-sys-typescale-title-large); }
.stage { position: relative; flex: 1; min-height: 0; }
.map { position: absolute; inset: 0; background: var(--md-sys-color-surface-container-highest); z-index: 0; }
.search { position: absolute; z-index: 5; left: 16px; right: 16px; top: 12px; height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-surface-container); box-shadow: var(--md-sys-elevation-3); }
.s-ico { width: 20px; height: 20px; flex: none; color: var(--md-sys-color-on-surface-variant); }
.s-in { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); }
.hits { position: absolute; z-index: 5; left: 16px; right: 16px; top: 68px; max-height: 50%; overflow: auto; border-radius: var(--md-sys-shape-corner-medium); background: var(--md-sys-color-surface-container); box-shadow: var(--md-sys-elevation-3); }
.hit { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 16px; box-sizing: border-box; cursor: pointer; }
.hit + .hit { border-top: 1px solid var(--md-sys-color-outline-variant); }
.h-ico { width: 20px; height: 20px; flex: none; color: var(--md-sys-color-on-surface-variant); }
.h-txt { display: flex; flex-direction: column; min-width: 0; }
.h-name { font: var(--md-sys-typescale-body-large); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h-sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* the pin stays in the middle; its tip (bottom centre of the icon) marks the position */
.pin { position: absolute; z-index: 4; left: 50%; top: 50%; width: 48px; height: 48px; transform: translate(-50%, -100%); color: var(--md-sys-color-primary); pointer-events: none; filter: drop-shadow(0 2px 2px color-mix(in srgb, black 35%, transparent)); }
.shadow { position: absolute; z-index: 3; left: 50%; top: 50%; width: 16px; height: 6px; margin: -3px 0 0 -8px; border-radius: 50%; background: color-mix(in srgb, black 25%, transparent); pointer-events: none; }
.locate { position: absolute; z-index: 5; right: 16px; bottom: 36px; box-shadow: var(--md-sys-elevation-3); }
.note { position: absolute; z-index: 5; left: 16px; right: 16px; bottom: 88px; margin: 0; padding: 8px 12px; border-radius: var(--md-sys-shape-corner-medium); background: var(--md-sys-color-inverse-surface); color: var(--md-sys-color-inverse-on-surface); font: var(--md-sys-typescale-body-medium); }
.credit { position: absolute; z-index: 5; left: 8px; bottom: 40px; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, white 85%, transparent); color: color-mix(in srgb, black 80%, white); font: var(--md-sys-typescale-label-small); font-weight: 400; }
.panel { flex: none; padding: 20px 20px calc(16px + var(--safe-bottom, 0px)); border-radius: 32px 32px 0 0; background: var(--md-sys-color-surface-container); margin-top: -32px; position: relative; z-index: 6; }
.sel { margin: 0; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.addr { margin: 2px 0 0; font: var(--md-sys-typescale-title-medium); font-weight: 600; overflow-wrap: anywhere; min-height: 26px; }
.coords { margin: 2px 0 0; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.off { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; background: var(--md-sys-color-surface-container-high); }
.off-ico { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.off-ico :deep(svg) { width: 32px; height: 32px; }
.off-title { margin: 0; font: var(--md-sys-typescale-headline-small); }
.off-text { margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
