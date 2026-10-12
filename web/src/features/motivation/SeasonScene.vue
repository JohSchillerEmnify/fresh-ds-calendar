<script setup lang="ts">
/**
 * Subtle seasonal backdrop for the top bar and the theme menu: a soft gradient plus a few slowly drifting particles
 * (petals, sun motes, leaves, snow). The drift runs only at the Full animation level.
 */
defineProps<{ season: 'spring' | 'summer' | 'fall' | 'winter' }>();
const particles = Array.from({ length: 9 }, (_, i) => ({ left: `${6 + i * 11}%`, delay: `${-(i * 1.3) % 7}s`, dur: `${7 + (i % 4) * 1.6}s`, size: `${5 + (i % 3) * 2}px` }));
</script>

<template>
  <div class="season" :class="season" :data-season="season">
    <i v-for="(p, n) in particles" :key="n" class="p" :style="{ left: p.left, animationDelay: p.delay, animationDuration: p.dur, width: p.size, height: p.size }" />
  </div>
</template>

<style scoped>
.season { position: absolute; inset: 0; overflow: hidden; opacity: 0.9; }
.spring { background: linear-gradient(180deg, color-mix(in srgb, #f8bbd0 38%, transparent), transparent 80%); }
.summer { background: radial-gradient(circle at 88% -30%, color-mix(in srgb, #ffd54f 70%, transparent), transparent 60%); }
.fall { background: linear-gradient(180deg, color-mix(in srgb, #ff8f00 26%, transparent), transparent 85%); }
.winter { background: linear-gradient(180deg, color-mix(in srgb, #90caf9 30%, transparent), transparent 85%); }
.p { position: absolute; top: -10px; opacity: 0.8; animation: drift 9s linear infinite; animation-play-state: paused; }
html[data-motion='full'] .p { animation-play-state: running; }
.spring .p { background: #f48fb1; border-radius: 80% 0 80% 0; }
.summer .p { background: #ffe082; border-radius: 50%; filter: blur(1px); animation-name: rise; top: auto; bottom: -10px; }
.fall .p { background: #e65100; border-radius: 0 80% 0 80%; }
.winter .p { background: #fff; border-radius: 50%; }
@keyframes drift { from { transform: translate(0, 0) rotate(0); } to { transform: translate(14px, 70px) rotate(240deg); opacity: 0; } }
@keyframes rise { from { transform: translateY(0); } to { transform: translateY(-60px); opacity: 0; } }
</style>
