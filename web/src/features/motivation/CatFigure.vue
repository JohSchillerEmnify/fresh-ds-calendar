<script setup lang="ts">
/**
 * The one cat drawing (ARCHITECTURE "Season scenes and the support cat"), shared by the support cat (`SupportCat`)
 * and the scene cat (`SceneCat`): a small sitting cat, three-quarter view facing left, coloured from the theme tokens
 * so it works in every theme, light and dark. Static by itself; the hosts animate its named parts:
 * `.tail`, `.torso` (body, stretch), `.paw` (raised front paw), `.head`, `.eyes` (blink / look), `.eyes-nap` + `.lids`
 * (eyes shut), `.calm` / `.grin` (faces) and `.zz` (nap). `pose` picks a still pose: `sit` (default), `grin`, `nap`.
 */
withDefaults(defineProps<{ pose?: 'sit' | 'grin' | 'nap' }>(), { pose: 'sit' });
</script>

<template>
  <svg class="catfig" :data-pose="pose" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path class="tail fur-line" d="M44 56 C56 57 61 47 56 38" />
    <g class="torso">
      <path class="fur" d="M21 59 C19 45 25 34 34 34 C44 34 49 45 48 59 Z" />
      <ellipse class="fur" cx="43" cy="55" rx="6.5" ry="4.5" />
      <ellipse class="light" cx="33" cy="50" rx="6" ry="7.5" />
      <path class="leg" d="M36 47 L36 58" />
      <ellipse class="fur" cx="36.5" cy="59" rx="3.4" ry="2.2" />
      <g class="paw">
        <path class="leg" d="M27 44 L27 57" />
        <ellipse class="fur" cx="27" cy="58" rx="3.6" ry="2.4" />
        <circle class="pink" cx="25.6" cy="58.4" r="0.8" /><circle class="pink" cx="28.4" cy="58.4" r="0.8" />
      </g>
    </g>
    <g class="head">
      <path class="fur" d="M17 23 L19 8.5 L29 17 Z" />
      <path class="fur" d="M32 17 L42 8.5 L44 23 Z" />
      <path class="pink" d="M20 19 L20.8 12.5 L26 17 Z" />
      <path class="pink" d="M35 17 L40.5 12.5 L41.5 19 Z" />
      <ellipse class="fur" cx="30.5" cy="25" rx="14" ry="11.5" />
      <path class="stripe" d="M30.5 14.2 L30.5 18 M27 14.8 L27.8 17.6 M34 14.8 L33.2 17.6" />
      <ellipse class="light" cx="30.5" cy="30" rx="6.5" ry="4.2" />
      <circle class="cheek" cx="21.5" cy="28.6" r="2.3" /><circle class="cheek" cx="39.5" cy="28.6" r="2.3" />
      <g class="calm">
        <g class="eyes-nap">
          <g class="eyes">
            <ellipse class="ink" cx="25.5" cy="23.8" rx="2.3" ry="2.9" /><ellipse class="ink" cx="35.5" cy="23.8" rx="2.3" ry="2.9" />
            <circle class="shine" cx="26.3" cy="22.8" r="0.8" /><circle class="shine" cx="36.3" cy="22.8" r="0.8" />
          </g>
        </g>
        <path class="lids mouth" d="M23.2 24 Q25.5 26.2 27.8 24 M33.2 24 Q35.5 26.2 37.8 24" />
        <path class="mouth" d="M28.3 30 Q29.4 31.6 30.5 30 Q31.6 31.6 32.7 30" />
      </g>
      <g class="grin">
        <path class="mouth" d="M23 25 Q25.5 21.2 28 25 M33 25 Q35.5 21.2 38 25" />
        <path class="ink" d="M26.2 29.4 Q30.5 36 34.8 29.4 Q30.5 31.2 26.2 29.4 Z" />
        <path class="pink" d="M28.6 32.4 Q30.5 34.2 32.4 32.4 Q30.5 31.6 28.6 32.4 Z" />
      </g>
      <path class="pink" d="M29.2 27.6 L31.8 27.6 L30.5 29.2 Z" />
      <path class="whisker" d="M22 29 L13.5 27.6 M22 30.6 L14 32 M39 29 L47.5 27.6 M39 30.6 L47 32" />
    </g>
    <text class="zz" x="45" y="11">z</text>
  </svg>
</template>

<style scoped>
.catfig {
  --cat-fur: color-mix(in srgb, var(--md-sys-color-tertiary) 38%, var(--md-sys-color-surface-container-highest));
  --cat-dark: color-mix(in srgb, var(--md-sys-color-tertiary) 70%, var(--md-sys-color-on-surface));
  --cat-light: color-mix(in srgb, var(--md-sys-color-surface-container-lowest) 85%, var(--md-sys-color-tertiary));
  --cat-ink: var(--md-sys-color-on-surface);
  --cat-pink: color-mix(in srgb, #ff7aa2 60%, var(--md-sys-color-tertiary-container));
  --cat-line: color-mix(in srgb, var(--md-sys-color-on-surface) 70%, transparent);
  display: block; width: 100%; height: 100%; overflow: visible;
}
.fur { fill: var(--cat-fur); stroke: var(--cat-line); stroke-width: 1; stroke-linejoin: round; }
.light { fill: var(--cat-light); }
.leg { fill: none; stroke: var(--cat-fur); stroke-width: 5.5; stroke-linecap: round; }
.fur-line { fill: none; stroke: var(--cat-dark); stroke-width: 4.5; stroke-linecap: round; }
.stripe { fill: none; stroke: var(--cat-dark); stroke-width: 1.4; stroke-linecap: round; }
.pink { fill: var(--cat-pink); }
.cheek { fill: var(--cat-pink); opacity: 0.45; }
.ink { fill: var(--cat-ink); }
.shine { fill: var(--md-sys-color-surface-container-lowest); }
.mouth { fill: none; stroke: var(--cat-ink); stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.whisker { fill: none; stroke: var(--cat-line); stroke-width: 0.7; stroke-linecap: round; }
.zz { font: 600 9px/1 system-ui, sans-serif; fill: var(--cat-dark); }
/* every part pivots in the drawing's own coordinates, so hosts only set the motion */
.tail, .torso, .paw, .head, .eyes, .eyes-nap, .lids, .zz { transform-box: view-box; }
.tail { transform-origin: 44px 56px; }
.torso { transform-origin: 34px 60px; }
.paw { transform-origin: 27px 44px; }
.head { transform-origin: 30.5px 34px; }
.eyes, .eyes-nap { transform-origin: 30.5px 23.8px; }
.zz { transform-origin: 46px 10px; }

/* still poses: sit (awake, calm face), grin, nap (eyes shut, a z) */
.grin, .lids, .zz { opacity: 0; }
[data-pose='grin'] .grin { opacity: 1; }
[data-pose='grin'] .calm { opacity: 0; }
[data-pose='nap'] .eyes-nap { transform: scaleY(0.05); }
[data-pose='nap'] .lids, [data-pose='nap'] .zz { opacity: 1; }
</style>
