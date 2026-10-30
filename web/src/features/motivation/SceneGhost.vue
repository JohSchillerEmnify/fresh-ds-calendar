<script setup lang="ts">
/**
 * The small friendly Halloween ghost (`data-part="ghost"`): a soft sheet ghost with big eyes, rosy cheeks, a little
 * "o" mouth and a waving arm. `drift` picks how it comes by during its ~8 s visit: `float` glides across the bar from
 * right to left with a gentle bob (Full), `fade` fades in and out in place (Reduced). The host shows it only during
 * a visit (never at Off). Colours from the theme tokens.
 */
defineProps<{ drift: 'float' | 'fade'; x: number }>();
</script>

<template>
  <span class="ghost" :class="drift" data-part="ghost" :style="{ '--ghost-x': `${x}cqw` }" aria-hidden="true">
    <span class="bob">
      <svg viewBox="0 0 30 34" focusable="false">
        <path class="arm" d="M5.400 17 C2.600 15.800 1 13.600 1.600 12.200 C2.400 11.200 4 12.800 5.600 14.200" />
        <path class="sheet" d="M4.600 30 C4 21 4.400 13 7 8.400 C9 4.800 12 3 15 3 C18 3 21 4.800 23 8.400 C25.600 13 26 21 25.400 30 C24 31.800 22.800 28.800 21.200 30.400 C19.600 32 18.400 29 16.800 30.400 C15.200 31.800 14 29 12.400 30.400 C10.800 31.800 9.600 28.800 8 30.400 C6.600 31.600 5.400 31 4.600 30 Z" />
        <path class="arm" d="M24.600 18 C27 18.400 28.400 20 28 21.400" />
        <ellipse class="eye" cx="11.600" cy="14.400" rx="1.700" ry="2.300" /><ellipse class="eye" cx="18.400" cy="14.400" rx="1.700" ry="2.300" />
        <circle class="glint" cx="12.200" cy="13.600" r="0.600" /><circle class="glint" cx="19" cy="13.600" r="0.600" />
        <ellipse class="mouth" cx="15" cy="19.400" rx="1.100" ry="1.400" />
        <circle class="cheek" cx="9" cy="18" r="1.400" /><circle class="cheek" cx="21" cy="18" r="1.400" />
      </svg>
    </span>
  </span>
</template>

<style scoped>
.ghost {
  --ghost: color-mix(in oklab, #fff 90%, var(--md-sys-color-primary, #e8650c));
  /* top is a fraction of what the bar shows (--d is what it clips above the 96 px layer) */
  position: absolute; left: 0; top: calc(var(--d, 0px) + (100cqh - var(--d, 0px)) * 0.04); width: min(46cqh, 30px);
  /* longhands: the build's minifier turns a shorthand without a name into `animation: none` (the ghost would not float) */
  animation-duration: 8s; animation-timing-function: ease-in-out; animation-fill-mode: both;
}
.ghost svg { display: block; width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 0 2px color-mix(in oklab, var(--ghost) 65%, transparent)); }
.sheet { fill: var(--ghost); stroke: color-mix(in oklab, var(--md-sys-color-outline, #85736c) 45%, transparent); stroke-width: 0.500; }
.arm { fill: var(--ghost); stroke: color-mix(in oklab, var(--md-sys-color-outline, #85736c) 45%, transparent); stroke-width: 0.500; }
.eye { fill: color-mix(in oklab, var(--md-sys-color-scrim, #000) 85%, #3b2a5a); }
.glint { fill: #fff; }
.mouth { fill: color-mix(in oklab, var(--md-sys-color-scrim, #000) 75%, #7a2a3a); }
.cheek { fill: color-mix(in oklab, #ff8fb1 80%, var(--md-sys-color-tertiary, #7d5260)); opacity: 0.5; }
.float { animation-name: ghost-float; }
.fade { animation-name: ghost-fade; translate: var(--ghost-x) 0; }
.bob { display: block; animation: ghost-bob 2.400s ease-in-out infinite alternate; }
.fade .bob { animation-duration: 4s; }
@keyframes ghost-float {
  0% { translate: calc(100cqw + 10px) 10cqh; opacity: 0; }
  10% { opacity: 0.92; }
  50% { translate: 50cqw 0; }
  90% { opacity: 0.92; }
  100% { translate: -40px 8cqh; opacity: 0; }
}
@keyframes ghost-fade { 0%, 100% { opacity: 0; } 20%, 80% { opacity: 0.88; } }
@keyframes ghost-bob { from { transform: translateY(-2px) rotate(-4deg); } to { transform: translateY(2px) rotate(4deg); } }
</style>
