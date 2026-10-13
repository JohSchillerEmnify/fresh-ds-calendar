<script setup lang="ts">
/**
 * Subtle seasonal backdrop for the top bar and the theme menu: a soft gradient plus a few slowly drifting particles
 * (petals, sun motes, leaves, snow). Halloween is a dusk (light) or night (dark) sky with twinkling stars instead.
 * The drift and the twinkle run only at the Full animation level.
 */
defineProps<{ season: 'spring' | 'summer' | 'fall' | 'winter' | 'halloween' }>();
const particles = Array.from({ length: 9 }, (_, i) => ({
  left: `${6 + i * 11}%`, top: `${6 + ((i * 37) % 46)}%`, delay: `${-(i * 1.3) % 7}s`, dur: `${7 + (i % 4) * 1.6}s`, size: `${5 + (i % 3) * 2}px`,
}));
</script>

<template>
  <div class="season" :class="season" :data-season="season">
    <i v-for="(p, n) in particles" :key="n" class="p" :style="{ left: p.left, '--top': p.top, animationDelay: p.delay, animationDuration: p.dur, width: p.size, height: p.size }" />
  </div>
</template>

<style scoped>
.season { position: absolute; inset: 0; overflow: hidden; opacity: 0.9; }
.spring { background: linear-gradient(180deg, color-mix(in srgb, #f8bbd0 38%, transparent), transparent 80%); }
.summer { background: radial-gradient(circle at 88% -30%, color-mix(in srgb, #ffd54f 70%, transparent), transparent 60%); }
.fall { background: linear-gradient(180deg, color-mix(in srgb, #ff8f00 26%, transparent), transparent 85%); }
.winter { background: linear-gradient(180deg, color-mix(in srgb, #90caf9 30%, transparent), transparent 85%); }
/* dusk (light): violet sky into a warm horizon; night (dark): deep indigo with an ember glow low down */
.halloween { opacity: 1; background: linear-gradient(180deg, color-mix(in oklab, #7b5aa6 30%, transparent), color-mix(in oklab, #ff9d4d 30%, transparent)); }
html[data-theme='dark'] .halloween { background: linear-gradient(180deg, color-mix(in oklab, #1d1442 62%, transparent), color-mix(in oklab, #3a1f4f 40%, transparent) 70%, color-mix(in oklab, #ff7a1a 16%, transparent)); }
.p { position: absolute; top: -10px; opacity: 0.8; animation: drift 9s linear infinite; animation-play-state: paused; }
html[data-motion='full'] .p { animation-play-state: running; }
.spring .p { background: #f48fb1; border-radius: 80% 0 80% 0; }
.summer .p { background: #ffe082; border-radius: 50%; filter: blur(1px); animation-name: rise; top: auto; bottom: -10px; }
.fall .p { background: #e65100; border-radius: 0 80% 0 80%; }
.winter .p { background: #fff; border-radius: 50%; }
.halloween .p { top: var(--top); width: 2px !important; height: 2px !important; border-radius: 50%; background: color-mix(in oklab, #fff6d6 85%, var(--md-sys-color-primary, #e8650c)); box-shadow: 0 0 3px #fff6d6; opacity: 0.35; animation-name: twinkle; animation-timing-function: ease-in-out; animation-direction: alternate; }
html[data-theme='dark'] .halloween .p { opacity: 0.9; }
.halloween .p:nth-child(3n) { width: 3px !important; height: 3px !important; }
@keyframes drift { from { transform: translate(0, 0) rotate(0); } to { transform: translate(14px, 70px) rotate(240deg); opacity: 0; } }
@keyframes twinkle { from { opacity: 0.15; transform: scale(0.7); } to { opacity: 0.95; transform: scale(1.1); } }
@keyframes rise { from { transform: translateY(0); } to { transform: translateY(-60px); opacity: 0; } }
</style>
