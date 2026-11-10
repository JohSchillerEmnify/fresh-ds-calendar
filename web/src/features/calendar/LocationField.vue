<script setup lang="ts">
/**
 * The event's location field with place suggestions (feature event-location).
 *
 * Typing at least three characters asks the place search (Photon, straight from the device) after a short pause and
 * shows up to five places under the field (kept while typing until the next answer, and remembered per query), credited to OpenStreetMap. Picking one puts its name in the field and its
 * address on a small line under it; changing the text afterwards drops the place again. Without a connection, or when
 * the search fails, it is the plain text field it always was: no list and no message. Keyboard: arrows highlight, Enter
 * picks the highlighted place (or moves on to the description), Escape closes the list without closing the dialog.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import TextField from '@/components/m3/TextField.vue';
import Button from '@/components/m3/Button.vue';
import { IconLocationOn, IconMapOutline } from '@/components/icons';
import { language, t } from '@/i18n';
import { useClockStore } from '@/stores/clock';
import MapPicker from './MapPicker.vue';
import { photonLang, searchPlaces, type PlacePick } from './place';


const props = defineProps<{ modelValue: string; place: PlacePick | null; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: string]; 'update:place': [p: PlacePick | null] }>();

/** Typed characters before anything is asked. */
const MIN_CHARS = 3;
/** The pause after the last key before asking ("a short pause"). */
const PAUSE_MS = 150;

const clock = useClockStore();
const root = ref<HTMLElement | null>(null);
const picking = ref(false);
const listId = useId();
const hits = ref<PlacePick[]>([]);
const active = ref(-1);
const open = computed(() => hits.value.length > 0);
const list = ref<HTMLElement | null>(null);
// the list opens under the field: bring it (with its credit) above the dialog's sticky actions
watch(open, async (o) => {
  if (!o) return;
  await nextTick();
  list.value?.scrollIntoView({ block: 'nearest' });
});
let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: AbortController | null = null;
let blurTimer: ReturnType<typeof setTimeout> | undefined;
/** Answers by query and language while the field lives, so a deleted letter shows its list at once. */
const answers = new Map<string, PlacePick[]>();

/** Forgets any search that is waiting or running; the shown list stays. */
function cancel(): void {
  clearTimeout(timer);
  inflight?.abort();
  inflight = null;
}

/** Closes the list and forgets any search that is waiting or running. */
function close(): void {
  cancel();
  hits.value = [];
  active.value = -1;
}

/** Asks the place search for `q`; only the newest request may fill the list. */
async function search(q: string, key: string): Promise<void> {
  const ctl = new AbortController();
  inflight = ctl;
  try {
    const found = await searchPlaces(clock.config.placeSearchUrl, q, photonLang(language.value), ctl.signal);
    if (inflight === ctl) { answers.set(key, found); hits.value = found; active.value = -1; }
  } catch {
    // offline, slow or refused: the field simply stays a text field (R13)
    if (inflight === ctl) hits.value = [];
  } finally {
    if (inflight === ctl) inflight = null;
  }
}

function onInput(v: string): void {
  emit('update:modelValue', v);
  // typing over a picked place makes it plain text again (R5)
  if (props.place && v !== props.place.name) emit('update:place', null);
  // the shown list stays until the new answer arrives; it goes only when nothing can be asked
  const q = v.trim();
  if (q.length < MIN_CHARS || !clock.config.placeSearchUrl || navigator.onLine === false) { close(); return; }
  active.value = -1;
  cancel();
  const key = `${photonLang(language.value)}\n${q}`;
  const known = answers.get(key);
  if (known) { hits.value = known; active.value = -1; return; }
  timer = setTimeout(() => { void search(q, key); }, PAUSE_MS);
}

/**
 * Takes a suggested place.
 *
 * @param p The place.
 * @param touch Picked by tapping: the input then lets go of the focus so the phone keyboard closes and the map shows.
 */
function pick(p: PlacePick, touch = false): void {
  close();
  emit('update:modelValue', p.name);
  emit('update:place', p);
  if (touch) (document.activeElement as HTMLElement | null)?.blur();
}

function onKeydown(e: KeyboardEvent): void {
  if (e.isComposing) return;
  if (open.value && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    const n = hits.value.length;
    active.value = e.key === 'ArrowDown' ? (active.value + 1) % n : (active.value <= 0 ? n - 1 : active.value - 1);
  } else if (e.key === 'Enter') {
    // the form's Enter-to-next-field never sees it: a highlighted place is picked, else the description is next (R8)
    e.preventDefault();
    e.stopPropagation();
    const hit = hits.value[active.value];
    if (hit) { pick(hit); return; }
    close();
    const next = (e.target as HTMLElement).closest('form')?.querySelector<HTMLElement>('[data-field="description"]');
    next?.focus();
    next?.scrollIntoView({ block: 'center' });
  } else if (e.key === 'Escape' && open.value) {
    // the list closes, the dialog stays (its Escape listener sits on the document)
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}

/** Leaving the field closes the list; a tap on a suggestion keeps the focus (mousedown is prevented), so it comes first. */
function onBlur(): void {
  clearTimeout(blurTimer);
  blurTimer = setTimeout(close, 150);
}

/** Back in the field (e.g. right after a tap elsewhere): the list stays. */
function onFocus(): void {
  clearTimeout(blurTimer);
}

/** The picker's "Use this place": the readable address fills the field, the pin's position is the place. */
function usePicked(p: PlacePick): void {
  picking.value = false;
  emit('update:modelValue', p.name);
  emit('update:place', p);
}

/** The picker's "Type an address instead" (offline): back to the plain field. */
function typeInstead(): void {
  picking.value = false;
  void nextTick(() => root.value?.querySelector('input')?.focus());
}

const optionId = (i: number) => `${listId}-${i}`;

onBeforeUnmount(() => { close(); clearTimeout(blurTimer); });
</script>

<template>
  <div ref="root" class="loc">
    <TextField
      :model-value="modelValue" :label="label" data-testid="event-location" data-field="location" autocomplete="off" enterkeyhint="next"
      role="combobox" aria-autocomplete="list" :aria-expanded="open" :aria-controls="open ? listId : undefined" :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
      @update:model-value="onInput" @keydown="onKeydown" @blur="onBlur" @focus="onFocus"
    />
    <p v-if="place?.address" class="addr" data-testid="event-location-address">{{ place.address }}</p>
    <div v-if="open" ref="list" class="list" data-testid="place-suggestions" @mousedown.prevent>
      <div :id="listId" role="listbox" :aria-label="t('calendar.event.place.suggestions')">
        <div
          v-for="(h, i) in hits" :id="optionId(i)" :key="`${h.lat},${h.lon},${h.name}`" class="opt" :class="{ on: i === active }" role="option" :aria-selected="i === active"
          data-testid="place-suggestion" @click="pick(h, true)"
        >
          <IconLocationOn class="pin" aria-hidden="true" />
          <span class="txt">
            <span class="name" data-testid="place-suggestion-name">{{ h.name }}</span>
            <span v-if="h.address" class="sub" data-testid="place-suggestion-address">{{ h.address }}</span>
          </span>
        </div>
      </div>
      <p class="credit" data-testid="place-suggestions-credit">{{ t('calendar.event.place.credit') }}</p>
    </div>
    <div class="pick">
      <Button variant="tonal" data-testid="event-location-pick-map" @click="picking = true"><template #icon><IconMapOutline /></template>{{ t('calendar.event.place.pickOnMap') }}</Button>
      <span v-if="!place" class="pick-hint">{{ t('calendar.event.place.pickHint') }}</span>
    </div>
    <MapPicker
      v-if="picking" :start="place" :tile-url="clock.config.mapTileUrl" :search-url="clock.config.placeSearchUrl"
      @use="usePicked" @cancel="picking = false" @type="typeInstead"
    />
  </div>
</template>

<style scoped>
.loc { display: flex; flex-direction: column; gap: 0; }
/* the address of a picked place: like the field's supporting text, wrapping instead of being cut off */
.pick { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.pick-hint { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.addr { margin: 4px 16px 0; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); overflow-wrap: anywhere; }
.list { scroll-margin-bottom: 88px; margin-top: 8px; background: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium); overflow: hidden; box-shadow: var(--md-sys-elevation-3); }
.opt { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 16px; box-sizing: border-box; cursor: pointer; }
.opt + .opt { border-top: 1px solid var(--md-sys-color-outline-variant); }
@media (hover: hover) { .opt:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); } }
.opt.on { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.pin { width: 20px; height: 20px; flex: none; color: var(--md-sys-color-on-surface-variant); }
.txt { display: flex; flex-direction: column; min-width: 0; }
.name { font: var(--md-sys-typescale-body-large); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.credit { margin: 0; padding: 4px 16px 8px; border-top: 1px solid var(--md-sys-color-outline-variant); font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); text-align: right; }
</style>
