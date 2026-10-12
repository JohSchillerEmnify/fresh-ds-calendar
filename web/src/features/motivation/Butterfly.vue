<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { springs } from '@/motion/spring';

/**
 * One butterfly visit (~3.6 s): flies in, lands on a random sunflower inside `container`, flaps, flies away,
 * emits `done` (the parent removes it from the DOM). pointer-events none, below the bar buttons.
 */
const props = defineProps<{ container: HTMLElement | null }>();
const emit = defineEmits<{ done: [] }>();
void springs;
const DURATION = 3600;
const root = ref<HTMLElement | null>(null);
const landed = ref(false);
let anim: Animation | null = null;
const timers: ReturnType<typeof setTimeout>[] = [];
let ended = false;

function end() {
  if (ended) return;
  ended = true;
  emit('done');
}

onMounted(() => {
  const c = props.container;
  const el = root.value;
  if (!c || !el || typeof el.animate !== 'function') return void end();
  const cr = c.getBoundingClientRect();
  const flowers = [...c.querySelectorAll('[data-testid="sunflower"]')];
  const target = flowers[Math.floor(Math.random() * flowers.length)];
  if (!target) return void end();
  const tr = target.getBoundingClientRect();
  const W = cr.width;
  const H = cr.height;
  // head of the flower is in the top ~30% of its box
  const hx = tr.left - cr.left + tr.width / 2 - 14;
  const hy = tr.top - cr.top + tr.height * 0.12 - 8;
  const fromLeft = hx > W / 2 ? true : Math.random() > 0.5;
  const sx = fromLeft ? -30 : W + 10;
  const ex = fromLeft ? W + 10 : -30;
  const T = (x: number, y: number, r = 0, s = 1) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;
  anim = el.animate(
    [
      { transform: T(sx, H * 0.75, fromLeft ? 20 : -20, 0.8), opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.06 },
      { transform: T(sx + (hx - sx) * 0.4, hy - 14 - H * 0.2, 10, 1), offset: 0.2, easing: 'ease-in-out' },
      { transform: T(sx + (hx - sx) * 0.75, hy - 18 + H * 0.05, -12, 1), offset: 0.36, easing: 'ease-in-out' },
      { transform: T(hx, hy, 0, 0.95), offset: 0.5, easing: 'ease-out' },
      { transform: T(hx, hy - 1, 0, 0.95), offset: 0.74 },
      { transform: T(hx + (ex - hx) * 0.2, hy - H * 0.5, fromLeft ? 25 : -25, 1), offset: 0.84, easing: 'ease-in' },
      { transform: T(ex, -H * 0.8, fromLeft ? 35 : -35, 1), opacity: 0.9, offset: 0.97 },
      { opacity: 0, offset: 1 },
    ],
    { duration: DURATION, easing: 'linear', fill: 'both' },
  );
  timers.push(setTimeout(() => (landed.value = true), DURATION * 0.5));
  timers.push(setTimeout(() => (landed.value = false), DURATION * 0.74));
  anim.finished.then(end, end);
  timers.push(setTimeout(end, DURATION + 500)); // hard fallback
});
onBeforeUnmount(() => {
  timers.forEach(clearTimeout);
  timers.length = 0;
  anim?.cancel();
});
</script>

<template>
  <div ref="root" class="bf" data-testid="reward-effect" data-kind="butterfly" :data-landed="landed" aria-hidden="true">
    <svg viewBox="0 0 28 24" width="28" height="24">
      <g class="wing wl"><path d="M14 12 C8 2 1 3 2 9 C3 14 9 14 14 12Z" /><path d="M14 12 C9 14 5 20 9 21 C12 21 14 16 14 12Z" class="lo" /></g>
      <g class="wing wr"><path d="M14 12 C20 2 27 3 26 9 C25 14 19 14 14 12Z" /><path d="M14 12 C19 14 23 20 19 21 C16 21 14 16 14 12Z" class="lo" /></g>
      <ellipse cx="14" cy="12.500" rx="1.100" ry="5" class="body" />
    </svg>
  </div>
</template>

<style scoped>
.bf { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 0; will-change: transform; opacity: 0; }
.wing { fill: var(--md-sys-color-tertiary, #b5486f); opacity: 0.85; transform-box: view-box; transform-origin: 14px 12px; animation: bf-flap 0.2s ease-in-out infinite alternate; }
.wing .lo { fill: var(--md-sys-color-primary, #6750a4); opacity: 0.8; }
.wr { animation-name: bf-flap; }
.body { fill: var(--md-sys-color-on-surface, #1d1b20); }
.bf[data-landed='true'] .wing { animation-duration: 0.55s; }
@keyframes bf-flap { from { transform: scaleX(1); } to { transform: scaleX(0.25); } }
</style>
