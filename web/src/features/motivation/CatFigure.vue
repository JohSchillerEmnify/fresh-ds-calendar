<script setup lang="ts">
/**
 * The one cat drawing (ARCHITECTURE "Season scenes and the support cat", "Cat look"), shared by the support cat
 * (`SupportCat`) and the scene cat (`SceneCat`): a flat paper-cut cat seen from the front, "a small void in cat shape"
 * (owner) — an almost featureless black silhouette, a tall narrow body flowing into a small head without a neck, two
 * front legs at the bottom and the tail rising straight up behind it with a hook at the tip. Only the features stand
 * out: yellow ring eyes set close together, pink-lined triangle ears, a tiny grey nose and long thin whiskers. No
 * outlines, no mouth, no inner markings; a very faint paper grain (SVG noise filter) on the black. Colours come from
 * the theme tokens; on dark themes a soft rim light lets the silhouette read.
 *
 * Static by itself; the hosts animate its named parts: `.tail` (whole tail, sway from its base), `.tail-tip` (the
 * hook, flicks), `.torso` (body, stretch), `.paw` (the front leg on the viewer's left: steps, swipes), `.leg-b` (the
 * other front leg: steps), `.head` (tilt), `.ear-l` / `.ear-r` (twitch), `.eyes` (blink), `.pupils` (look; or set
 * `--cat-look-x` / `--cat-look-y` in drawing units), `.eyes-nap` + `.lids` (eyes shut), `.calm` / `.grin` (faces; the
 * grin squints the eyes into happy arcs) and `.zz` (nap). `pose` picks a still pose: `sit` (default), `grin`, `nap`
 * (eyes shut).
 */
import { useId } from 'vue';

withDefaults(defineProps<{ pose?: 'sit' | 'grin' | 'nap' }>(), { pose: 'sit' });
/** Per-instance filter id (several cats can be on one page). */
const grain = `cat-grain-${useId()}`;
const fur = `url(#${grain})`;
</script>

<template>
  <svg class="catfig" :data-pose="pose" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <!-- paper grain: faint light specks only where the black is, so the void stays a void. The region is in drawing
           units (not the element's box): the legs are straight lines whose box has no width. -->
      <filter :id="grain" filterUnits="userSpaceOnUse" x="-16" y="-16" width="96" height="96" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.900" numOctaves="2" seed="11" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.450 0 0 0 -0.240" result="specks" />
        <feComposite in="specks" in2="SourceAlpha" operator="in" result="grain" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="grain" /></feMerge>
      </filter>
    </defs>
    <g class="tail">
      <path class="tail-line" :filter="fur" d="M38 56.600 C44.500 56.800 47.600 54 47.700 48 L47.800 29" />
      <g class="tail-tip">
        <path class="tail-line tip" :filter="fur" d="M47.800 29.400 C47.900 23.600 46.700 20.700 44.600 20.800 C43.300 20.900 42.900 22.100 43.500 23" />
      </g>
    </g>
    <g class="torso">
      <path class="fur" :filter="fur" d="M24.200 17 C22.600 23 21.800 30 21.300 38 C20.800 46 20 53 20.600 57.600 C20.900 60 22.300 60.800 24.400 60.800 L30.400 60.800 L32 58.400 L33.600 60.800 L39.600 60.800 C41.700 60.800 43.100 60 43.400 57.600 C44 53 43.200 46 42.700 38 C42.200 30 41.400 23 39.800 17 Z" />
      <g class="leg-b"><path class="leg" :filter="fur" d="M35.300 42 L35.300 60.200" /></g>
      <g class="paw"><path class="leg" :filter="fur" d="M28.700 42 L28.700 60.200" /></g>
    </g>
    <g class="head">
      <g class="ear-l">
        <path class="fur" :filter="fur" d="M22.300 13.400 L22.700 1.600 L29.800 8.300 Z" />
        <path class="pink" d="M23.700 10.800 L24 4.700 L27.900 8.500 Z" />
      </g>
      <g class="ear-r">
        <path class="fur" :filter="fur" d="M41.700 13.400 L41.300 1.600 L34.200 8.300 Z" />
        <path class="pink" d="M40.300 10.800 L40 4.700 L36.100 8.500 Z" />
      </g>
      <path class="fur" :filter="fur" d="M22 14.600 C22 9.700 26.400 7 32 7 C37.600 7 42 9.700 42 14.600 C42 18.700 40.200 21.900 37.600 23.900 C35.900 25.200 34 25.700 32 25.700 C30 25.700 28.100 25.200 26.400 23.900 C23.800 21.900 22 18.700 22 14.600 Z" />
      <g class="calm">
        <g class="eyes-nap">
          <g class="eyes">
            <circle class="iris" cx="27.700" cy="15.600" r="4.100" /><circle class="iris" cx="36.300" cy="15.600" r="4.100" />
            <g class="pupils">
              <circle class="pupil" cx="27.700" cy="15.600" r="2.500" /><circle class="pupil" cx="36.300" cy="15.600" r="2.500" />
              <circle class="shine" cx="28.600" cy="14.600" r="0.650" /><circle class="shine" cx="37.200" cy="14.600" r="0.650" />
            </g>
          </g>
        </g>
        <path class="lids" d="M24 16.200 Q27.700 18.800 31.400 16.200 M32.600 16.200 Q36.300 18.800 40 16.200" />
      </g>
      <g class="grin">
        <path class="happy" d="M24.200 17.200 Q27.700 12.600 31.200 17.200 M32.800 17.200 Q36.300 12.600 39.800 17.200" />
      </g>
      <path class="nose" d="M30.900 20.700 L33.100 20.700 L32 22 Z" />
      <path class="whisker" d="M29.600 21.700 L8.500 19.400 M29.600 22.500 L9 24.400 M29.800 23.200 L11 28.600 M34.400 21.700 L55.500 19.400 M34.400 22.500 L55 24.400 M34.200 23.200 L53 28.600" />
    </g>
    <text class="zz" x="45" y="7">z</text>
  </svg>
</template>

<style scoped>
.catfig {
  --cat-fur: color-mix(in oklab, #000 93%, var(--md-sys-color-tertiary, #7d5260));
  --cat-eye: color-mix(in oklab, #ffd23f 90%, var(--md-sys-color-primary, #6750a4));
  --cat-pupil: #000;
  --cat-pink: color-mix(in oklab, #ff8fb1 84%, var(--md-sys-color-tertiary, #7d5260));
  --cat-grey: color-mix(in oklab, #aaa4b0 85%, var(--md-sys-color-outline, #79747e));
  --cat-whisker: color-mix(in oklab, #fff 50%, var(--md-sys-color-outline, #79747e));
  display: block; width: 100%; height: 100%; overflow: visible;
}
/* night: just enough rim light (moonlight from the theme's on-surface) for the black silhouette to read */
html[data-theme='dark'] .catfig {
  --cat-whisker: color-mix(in oklab, #fff 78%, var(--md-sys-color-outline, #938f99));
  filter: drop-shadow(0 0 0.5px color-mix(in oklab, var(--md-sys-color-on-surface, #e6e1e5) 70%, transparent))
    drop-shadow(0 0 2px color-mix(in oklab, var(--md-sys-color-on-surface, #e6e1e5) 28%, transparent));
}
.fur { fill: var(--cat-fur); }
.leg { fill: none; stroke: var(--cat-fur); stroke-width: 4.400; stroke-linecap: round; }
.tail-line { fill: none; stroke: var(--cat-fur); stroke-width: 3.200; stroke-linecap: round; stroke-linejoin: round; }
.tail-line.tip { stroke-width: 2.900; }
.pink { fill: var(--cat-pink); }
.iris { fill: var(--cat-eye); }
.pupil { fill: var(--cat-pupil); }
.shine { fill: #fff; opacity: 0.9; }
.nose { fill: var(--cat-grey); }
.lids { fill: none; stroke: var(--cat-eye); stroke-width: 1.300; stroke-linecap: round; }
.happy { fill: none; stroke: var(--cat-eye); stroke-width: 1.900; stroke-linecap: round; }
.whisker { fill: none; stroke: var(--cat-whisker); stroke-width: 0.400; stroke-linecap: round; opacity: 0.9; }
.zz { font: 600 9px/1 system-ui, sans-serif; fill: var(--cat-eye); }
/* every part pivots in the drawing's own coordinates, so hosts only set the motion */
.tail, .tail-tip, .torso, .paw, .leg-b, .head, .ear-l, .ear-r, .eyes, .pupils, .eyes-nap, .lids, .zz { transform-box: view-box; }
.tail { transform-origin: 44px 57px; }
.tail-tip { transform-origin: 47.800px 29.500px; }
.torso { transform-origin: 32px 61px; }
.paw { transform-origin: 28.700px 42px; }
.leg-b { transform-origin: 35.300px 42px; }
.head { transform-origin: 32px 25px; }
.ear-l { transform-origin: 25px 11px; }
.ear-r { transform-origin: 39px 11px; }
.eyes, .eyes-nap { transform-origin: 32px 15.600px; }
.pupils { transform: translate(var(--cat-look-x, 0px), var(--cat-look-y, 0px)); }
.zz { transform-origin: 46px 6px; }

/* still poses: sit (awake, calm face), grin (happy squint), nap (eyes shut, a z) */
.grin, .lids, .zz { opacity: 0; }
[data-pose='grin'] .grin { opacity: 1; }
[data-pose='grin'] .calm { opacity: 0; }
[data-pose='nap'] .eyes-nap { transform: scaleY(0.05); }
[data-pose='nap'] :is(.lids, .zz) { opacity: 1; }
</style>
