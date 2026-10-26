<script setup lang="ts">
/**
 * The event's location field with place suggestions (feature event-location).
 *
 * Typing at least three characters asks the place search (Photon, straight from the device) after a short pause and
 * shows up to five places under the field, credited to OpenStreetMap. Picking one puts its name in the field and its
 * address on a small line under it; changing the text afterwards drops the place again. Without a connection, or when
 * the search fails, it is the plain text field it always was: no list and no message. Keyboard: arrows highlight, Enter
 * picks the highlighted place (or moves on to the description), Escape closes the list without closing the dialog.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import TextField from '@/components/m3/TextField.vue';
import { IconLocationOn } from '@/components/icons';
import { language, t } from '@/i18n';
import { useClockStore } from '@/stores/clock';
import { photonLang, searchPlaces, type PlacePick } from './place';

const props = defineProps<{ modelValue: string; place: PlacePick | null; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: string]; 'update:place': [p: PlacePick | null] }>();

/** Typed characters before anything is asked (owner, Q4). */
const MIN_CHARS = 3;
/** The pause after the last key before asking (owner, Q4: "a short pause"). */
const PAUSE_MS = 300;

const clock = useClockStore();
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

/** Closes the list and forgets any search that is waiting or running. */
function close(): void {
  clearTimeout(timer);
  inflight?.abort();
  inflight = null;
  hits.value = [];
  active.value = -1;
}

/** Asks the place search for `q`; only the newest request may fill the list. */
async function search(q: string): Promise<void> {
  const ctl = new AbortController();
  inflight = ctl;
  try {
    const found = await searchPlaces(clock.config.placeSearchUrl, q, photonLang(language.value), ctl.signal);
    if (inflight === ctl) { hits.value = found; active.value = -1; }
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
  close();
  const q = v.trim();
  if (q.length < MIN_CHARS || !clock.config.placeSearchUrl || navigator.onLine === false) return;
  timer = setTimeout(() => { void search(q); }, PAUSE_MS);
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

const optionId = (i: number) => `${listId}-${i}`;

onBeforeUnmount(() => { close(); clearTimeout(blurTimer); });
</script>

<template>
  <div class="loc">
    <TextField
      :model-value="modelValue" :label="label" data-testid="event-location" data-field="location" autocomplete="off" enterkeyhint="next"
      role="combobox" aria-autocomplete="list" :aria-expanded="open" :aria-controls="listId" :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
      @update:model-value="onInput" @keydown="onKeydown" @blur="onBlur" @focus="onFocus"
    />
    <p v-if="place?.address" class="addr" data-testid="event-location-address">{{ place.address }}</p>
    <div v-if="open" :id="listId" ref="list" class="list" role="listbox" :aria-label="t('calendar.event.place.suggestions')" data-testid="place-suggestions" @mousedown.prevent>
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
      <p class="credit" data-testid="place-suggestions-credit">{{ t('calendar.event.place.credit') }}</p>
    </div>
  </div>
</template>

<style scoped>
.loc { display: flex; flex-direction: column; gap: 0; }
/* the address of a picked place: like the field's supporting text, wrapping instead of being cut off (owner, Q9) */
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
