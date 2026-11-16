<script setup lang="ts">
/**
 * The calendar swipe area (`calendar-swipe-area`): renders the routed view and turns horizontal swipes into period
 * changes (feature mobile-first-layout).
 * - Full motion on a calendar view: live carousel. When the swipe turns horizontal, the neighbouring period is mounted
 *   beside the current one as a preview copy of the same view (`preview`, inert, `aria-hidden`, cached items, its range
 *   prefetched), and the track follows the finger (transform only, written once per frame). On release it settles
 *   with a short spring and the route changes; the neighbour stays in place until the routed view has rendered the
 *   new period, then it is dropped and the track reset in the same tick, so nothing flashes. Else it springs back.
 * - Reduced/Off motion, Labs views: the instant swipe (`bindSwipe`), as before.
 * The default slot is rendered above the views and does not move (calendar headers).
 */
import { markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { useNav } from '@/composables/useNav';
import { swipeKeepsHours } from '@/composables/useHourHeight';
import { bindSwipe } from '@/composables/useSwipe';
import { bindSwipeCarousel, settleVelocity, type SwipeDir } from '@/composables/useSwipeCarousel';
import { fetchRange, periodBounds, shiftPeriod, toIsoDate, type ViewKind } from '@/lib/dates';
import { canAnimate, finished, getMotionLevel, springEasing, type SpringParams } from '@/motion';
import { useCalendarStore } from '@/stores/calendar';
import { useItemsStore } from '@/stores/items';

const props = defineProps<{ disabled: () => boolean }>();
const route = useRoute();
const nav = useNav();
const cal = useCalendarStore();
const items = useItemsStore();

/** Critically damped (no overshoot past the neighbour into empty space), about 0.3 s. */
const SETTLE_SPRING: SpringParams = { stiffness: 1000, damping: 1 };

interface Neighbour { dir: SwipeDir; anchor: Date; start: string; comp: Component }
const area = ref<HTMLElement | null>(null);
const track = ref<HTMLElement | null>(null);
const nb = shallowRef<Neighbour | null>(null);
/** Settling or springing back: new touches are ignored until the track is home. */
let busy = false;
let offset = 0;
let frame = 0;
let anim: Animation | null = null;

const live = () => getMotionLevel() === 'full' && !!route.meta.view;

function setX(x: number) {
  offset = x;
  if (track.value) track.value.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
}

/** The routed view's component (vue-router stores the resolved lazy component on the record). */
function viewComponent(): Component | null {
  const c = route.matched[route.matched.length - 1]?.components?.default;
  return c && typeof c === 'object' ? (c as Component) : null;
}

function start(dir: SwipeDir) {
  const view = route.meta.view as ViewKind;
  const comp = viewComponent();
  if (!comp) return;
  const anchor = shiftPeriod(view, cal.anchor, dir);
  nb.value = { dir, anchor, start: toIsoDate(periodBounds(view, anchor)[0]), comp: markRaw(comp) };
  // the year view loads its own summary; the others show cached items and fetch their range in the background
  if (view !== 'year') items.prefetch(...fetchRange(view, anchor));
}

function move(dx: number) {
  offset = dx;
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; setX(offset); });
}

function slide(from: number, to: number, vx: number): Promise<void> {
  const el = track.value;
  if (!el || from === to || !canAnimate(el)) { setX(to); return Promise.resolve(); }
  const { easing, duration } = springEasing(SETTLE_SPRING, settleVelocity(from, to, vx));
  const a = el.animate([{ transform: `translate3d(${from}px, 0, 0)` }, { transform: `translate3d(${to}px, 0, 0)` }], { duration, easing });
  anim = a;
  return finished(a).then(() => {
    // keep the end position as the inline style before dropping the animation (no frame in between)
    setX(to);
    a.cancel();
    if (anim === a) anim = null;
  });
}

async function end(target: SwipeDir | 0, vx: number) {
  if (frame) { cancelAnimationFrame(frame); frame = 0; }
  busy = true;
  try {
    // no neighbour (view not resolved): nothing to settle on
    const to = nb.value ? target : 0;
    await slide(offset, -to * (area.value?.clientWidth ?? 0), vx);
    if (to) {
      swipeKeepsHours.value = true;
      await (to === 1 ? nav.next() : nav.prev());
      // the routed view has re-rendered the new period (and run its initial scroll) before the neighbour goes
      await nextTick();
      await nextTick();
    }
  } finally {
    swipeKeepsHours.value = false;
    nb.value = null;
    setX(0);
    busy = false;
  }
}

/** The instant swipe (reduced motion) keeps the hours too. */
async function keepHours(turn: Promise<unknown> | unknown) {
  swipeKeepsHours.value = true;
  try { await turn; await nextTick(); await nextTick(); } finally { swipeKeepsHours.value = false; }
}

let stops: Array<() => void> = [];
onMounted(() => {
  const el = area.value!;
  stops = [
    bindSwipe(el, {
      onLeft: () => void keepHours(nav.next()),
      onRight: () => void keepHours(nav.prev()),
      disabled: () => props.disabled() || live(),
    }),
    bindSwipeCarousel(el, {
      disabled: () => busy || props.disabled() || !live(),
      width: () => el.clientWidth,
      start,
      move,
      end: (target, vx) => void end(target, vx),
      cancel: () => void end(0, 0),
    }),
  ];
});
onBeforeUnmount(() => {
  stops.forEach((s) => s());
  if (frame) cancelAnimationFrame(frame);
  anim?.cancel();
});
</script>

<template>
  <main ref="area" class="main" data-testid="calendar-swipe-area">
    <slot />
    <div ref="track" class="track" :class="{ swiping: !!nb }">
      <RouterView />
      <div
        v-if="nb" class="nb" data-testid="swipe-neighbour" :data-period-start="nb.start" aria-hidden="true" inert
        :style="{ left: `${nb.dir * 100}%` }"
      >
        <component :is="nb.comp" :anchor="nb.anchor" preview />
      </div>
    </div>
  </main>
</template>

<style scoped>
.main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; touch-action: pan-y; overflow: hidden; }
.track { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
/* its own layer only while a swipe is live */
.track.swiping { will-change: transform; }
.nb { position: absolute; top: 0; width: 100%; height: 100%; display: flex; flex-direction: column; pointer-events: none; }
</style>
