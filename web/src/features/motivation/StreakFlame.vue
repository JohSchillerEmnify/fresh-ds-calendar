<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { animate } from '@/motion/animate';
import { spawnSparkle } from '@/motion/effects';
import { springs } from '@/motion/spring';

/**
 * Flame + count. When `pulse` increments (a new-day check-in) the flame crackles for ~1 s and the number ticks up.
 * Idle = fully static (no animation running). Text content of the root is the current count.
 */
const props = defineProps<{ count: number; pulse?: number }>();
const flame = ref<SVGElement | null>(null);
const num = ref<HTMLElement | null>(null);
const old = ref<number | null>(null);
let anims: Animation[] = [];
let prevCount = props.count;

watch(
  () => props.pulse,
  (n, o) => {
    if (n === undefined || n === o) return;
    const from = prevCount;
    crackle(from);
  },
);
watch(
  () => props.count,
  (c) => {
    prevCount = c;
  },
  { flush: 'post' },
);

function crackle(from: number) {
  anims.forEach((a) => a.cancel());
  anims = [];
  const f = flame.value;
  const a = animate(
    f,
    [
      { transform: 'scale(0.7) rotate(0deg)', filter: 'brightness(1)' },
      { transform: 'scale(1.35) rotate(-7deg)', filter: 'brightness(1.5)', offset: 0.14 },
      { transform: 'scale(0.95) rotate(6deg)', filter: 'brightness(1.1)', offset: 0.3 },
      { transform: 'scale(1.22) rotate(-5deg)', filter: 'brightness(1.4)', offset: 0.46 },
      { transform: 'scale(1) rotate(3deg)', filter: 'brightness(1.1)', offset: 0.64 },
      { transform: 'scale(1.1) rotate(-2deg)', filter: 'brightness(1.2)', offset: 0.82 },
      { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1)' },
    ],
    { duration: 950, easing: 'ease-in-out', reduced: 'skip' },
  );
  if (a) anims.push(a);
  if (f) spawnSparkle(f, { kind: 'streak', count: 6, spread: 24, colors: ['#ffb02e', '#ff7a1a', '#ffe08a'] });
  // number tick-up: old digit slides out, new slides in
  if (from !== props.count) {
    old.value = from;
    const n = animate(num.value, [{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { spring: springs.pop, delay: 180, reduced: 'skip' });
    if (n) {
      anims.push(n);
      n.finished.then(() => (old.value = null), () => (old.value = null));
    } else old.value = null;
  }
}
onBeforeUnmount(() => anims.forEach((a) => a.cancel()));
const label = computed(() => `Streak: ${props.count} ${props.count === 1 ? 'day' : 'days'}`);
</script>

<template>
  <span class="sf" data-testid="streak-flame" role="img" :aria-label="label">
    <svg ref="flame" class="sf-flame" viewBox="0 0 24 28" width="22" height="26" aria-hidden="true">
      <defs>
        <linearGradient id="sf-g1" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#ff5a1f" /><stop offset="1" stop-color="#ffb02e" />
        </linearGradient>
      </defs>
      <path d="M12 1c1 5 7 8 7 15a7 7 0 0 1-14 0c0-3 1.600-5 3-6.500.2 2 1 3 2 3.500C10.500 9 11 5 12 1z" fill="url(#sf-g1)" />
      <path d="M12 14c.6 2.400 3.400 3.600 3.400 6.600a3.400 3.400 0 0 1-6.800 0C8.600 18.500 10.800 17 12 14z" fill="#ffe08a" />
    </svg>
    <span ref="num" class="sf-num" :data-old="old ?? undefined">{{ count }}</span>
  </span>
</template>

<style scoped>
.sf { display: inline-flex; align-items: center; gap: 2px; font: 700 0.95rem/1 system-ui, sans-serif; color: var(--md-sys-color-on-surface, #1d1b20); font-variant-numeric: tabular-nums; }
.sf-flame { transform-origin: 50% 90%; filter: drop-shadow(0 0 3px rgba(255, 140, 40, 0.45)); }
.sf-num { position: relative; display: inline-block; min-width: 0.6em; }
.sf-num[data-old]::before { content: attr(data-old); position: absolute; right: 0; top: 0; animation: sf-out 360ms ease-in forwards; }
@keyframes sf-out { to { transform: translateY(-70%); opacity: 0; } }
:global(html[data-motion='off']) .sf-num::before, :global(html[data-motion='reduced']) .sf-num::before { display: none; }
</style>
