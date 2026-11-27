/** State of the item search sheet (feature item-search): the query, the device results in their order, and the search beyond the device. */
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { CalendarEvent, LocalDate } from '@/api/types';
import { dedupeBirthdays } from '@calendar/shared/birthdays';
import { windowOf } from '@/lib/deviceData';
import { logUndone } from '@/lib/decisionLog';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { onSearchWipe } from '@/stores/itemSearch';
import { ItemIndex, matchedItemTitle, type IndexHit, type Searchable } from './searchIndex';
import { dayOf, orderHits } from './searchOrder';
import { eventKey, useBeyondSearch } from './useBeyondSearch';

/** Rows drawn first, and added each time the list is scrolled to its end. */
const STEP = 20;

export interface ResultRow {
  key: string;
  item: Searchable;
  /** The matched task item of a list (the result names it). */
  itemTitle: string | null;
  /** The matched note or place of an event, when the title did not match. */
  detail: string | null;
  day: LocalDate | null;
  time: string | null;
  hidden: boolean;
  shared: boolean;
}

const index = new ItemIndex();
// the index belongs to the person whose copy it was built from
onSearchWipe(() => index.clear());
const keyOf = (it: Searchable): string => (it.kind === 'event' ? eventKey(it) : `l:${it.id}`);

/** The events and lists the device holds, birthdays seen twice shown once. */
function held(): Searchable[] {
  const d = useDeviceStore().data;
  return d ? [...dedupeBirthdays(d.events), ...d.taskLists] : [];
}

let running: Promise<void> | null = null;
let again = false;
/** Brings the index in step with the device copy; a call while one runs makes it go round once more, and all callers wait for the same run. */
function syncIndex(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do { again = false; await index.updateAsync(held()); } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Builds the index in the background before the search is first opened, so the first query does not wait for it. */
export function warmItemSearchIndex(): void {
  void syncIndex().catch((e) => logUndone('item search index', e));
}

/** The note or place an event matched on, when the title did not (the second line of its result). */
function detailOf(e: CalendarEvent, terms: IndexHit['terms']): string | null {
  const fields = new Set(Object.values(terms).flat());
  if (fields.has('title')) return null;
  if (fields.has('place') && e.location) return e.location;
  return fields.has('notes') ? e.description.split('\n').find((l) => l.trim()) ?? null : null;
}

export function useItemSearch(list: Ref<HTMLElement | null>) {
  const device = useDeviceStore();
  const clock = useClockStore();
  const cals = useCalendarsStore();
  const query = ref('');
  const ready = ref(false);
  /** The index could not be built: the list says so instead of showing nothing. */
  const failed = ref(false);
  const version = ref(0);
  const shown = ref(STEP);
  /** The dates the device holds: what the search covers first (the last day is the one before `to`). */
  const reach = computed(() => device.data?.window ?? windowOf(clock.today));
  /** Without a device copy the dates it holds are unknown: the search beyond waits for it. */
  const { events: beyond, state, loads, reset: resetBeyond, reachedEnd, stop } = useBeyondSearch(query, reach, computed(() => clock.today), computed(() => !!device.data));

  async function sync(): Promise<void> {
    try {
      await syncIndex();
      failed.value = false;
      ready.value = true;
    } catch (e) {
      failed.value = true;
      logUndone('item search index', e);
    } finally {
      version.value++;
    }
  }
  watch(() => device.data, () => void sync(), { immediate: true });
  // the search beyond the device waits for the device copy: once it is there the end of the list is checked again
  watch(() => !!device.data, () => { void Promise.resolve().then(checkEnd); });

  const ordered = computed<IndexHit[]>(() => {
    void version.value;
    return ready.value ? orderHits(index.search(query.value), clock.today) : [];
  });
  const total = computed(() => ordered.value.length + beyond.value.length);

  function rowOf(item: Searchable, terms: IndexHit['terms']): ResultRow {
    return {
      key: keyOf(item), item, day: dayOf(item), hidden: cals.isHidden(item.calendarId), shared: item.kind === 'tasklist' && !!item.shared,
      time: item.kind === 'event' ? (item.allDay ? null : item.start.slice(11, 16)) : item.time,
      itemTitle: item.kind === 'tasklist' ? matchedItemTitle(item, terms) : null,
      detail: item.kind === 'event' ? detailOf(item, terms) : null,
    };
  }
  /** The rows on screen: the first `shown` of the device results, then of the ones from beyond the device. */
  const deviceRows = computed(() => ordered.value.slice(0, shown.value).map((h) => rowOf(h.item, h.terms)));
  const beyondRows = computed(() => beyond.value.slice(0, Math.max(0, shown.value - ordered.value.length)).map((e) => rowOf(e, {})));
  /** The line under the device results is shown once they are all drawn. */
  const lineShown = computed(() => state.value !== 'idle' && shown.value >= ordered.value.length);
  const empty = computed(() => ready.value && !!query.value.trim() && total.value === 0 && (state.value === 'done' || state.value === 'offline'));

  /** A new query starts again at the top. */
  function reset(): void {
    resetBeyond();
    shown.value = STEP;
    if (list.value) list.value.scrollTop = 0;
  }
  watch(query, reset);

  /** The list reached its end: draws more rows of what is known, else asks beyond the device. */
  function checkEnd(): void {
    const el = list.value;
    if (!el || !ready.value || el.scrollHeight - el.scrollTop - el.clientHeight > 80) return;
    if (shown.value < total.value) shown.value += STEP;
    else reachedEnd();
  }
  // short lists end where they start: whatever changes the rows is checked once the page has drawn them
  watch([total, shown, ready, query], () => { void Promise.resolve().then(checkEnd); }, { flush: 'post' });

  onBeforeUnmount(stop);

  return { query, ready, reach, total, deviceRows, beyondRows, state, loads, lineShown, empty, failed, checkEnd };
}
