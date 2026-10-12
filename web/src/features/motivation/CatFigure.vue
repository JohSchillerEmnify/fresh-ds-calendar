<script setup lang="ts">
/**
 * The one cat drawing (ARCHITECTURE "Season scenes and the support cat", "Cat look"), shared by the support cat
 * (`SupportCat`) and the scene cat (`SceneCat`): a black, geometric, slightly naive cat — tall narrow body seen half
 * from the side, head turned to the viewer, sharp triangle ears with pink insides, big yellow ring eyes around dark
 * pupils, a small grey triangle nose, fine light whiskers, a thick tail curled around its feet and a subtle fur
 * texture. Colours come from the theme tokens; on dark themes a soft rim light keeps the black body readable.
 *
 * Static by itself; the hosts animate its named parts: `.tail` (the curled tail tip), `.torso` (body, stretch),
 * `.paw` (raised front paw), `.head` (tilt), `.ear-l` / `.ear-r` (twitch), `.eyes` (blink), `.pupils` (look; or set
 * `--cat-look-x` / `--cat-look-y` in drawing units), `.eyes-nap` + `.lids` (eyes shut), `.calm` / `.grin` (faces; the
 * grin squints the eyes into happy arcs) and `.zz` (nap). `pose` picks a still pose: `sit` (default), `grin`, `nap`.
 */
withDefaults(defineProps<{ pose?: 'sit' | 'grin' | 'nap' }>(), { pose: 'sit' });
</script>

<template>
  <svg class="catfig" :data-pose="pose" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <g class="torso">
      <path class="fur" d="M24.500 61 C23.500 51 24 41 27.500 33 L36 32 C42 36 47 44 47.500 52 C48 56 47 60 45.500 61 Z" />
      <path class="fur" d="M36.500 61 C35 53 38 46.500 43 46.500 C47.500 46.500 49.500 52.500 48.500 57.500 C48 59.500 47 61 45.500 61 Z" />
      <ellipse class="fur" cx="45.400" cy="61" rx="3.600" ry="1.700" />
      <path class="tex" d="M38.600 53.500 C39.500 50 42 48 44.600 48 M27.600 38 L29 39.600 M26.700 42.600 L28.200 44 M27 47.200 L28.400 48.600 M40 39.600 L41.600 38.800 M43.200 44.400 L44.800 43.800" />
      <path class="leg" d="M33.600 44 L33.600 60" />
      <ellipse class="fur" cx="33.900" cy="60.800" rx="2.800" ry="1.600" />
      <path class="tex" d="M33.200 59.800 L33.200 61 M34.700 59.800 L34.700 61" />
      <g class="paw">
        <path class="leg near" d="M28.200 43 L28.200 60" />
        <ellipse class="fur" cx="28" cy="61" rx="3" ry="1.700" />
        <path class="tex" d="M27.200 60.300 L27.200 61.600 M28.800 60.300 L28.800 61.600" />
        <circle class="pink" cx="27" cy="61.900" r="0.550" /><circle class="pink" cx="29" cy="61.900" r="0.550" />
      </g>
      <path class="tail-base" d="M45 59.600 C53 59 56.400 62.300 48 62.300 L32 62.300" />
    </g>
    <path class="tail" d="M32.500 62.300 C25.400 62.300 20.400 61 20.600 57.400 C20.800 55.200 22.800 54.700 23.700 56" />
    <path class="tex tail-hi" d="M45.400 58.300 C51 58.200 54.200 59.600 53.600 60.600 M30 60.600 C25.600 60.400 22.400 59.600 22.200 57.600" />
    <g class="head">
      <g class="ear-l">
        <path class="fur" d="M20 17 L20.500 3.500 L29 11.500 Z" />
        <path class="pink" d="M21.600 14.200 L21.900 6.800 L26.600 11.200 Z" />
      </g>
      <g class="ear-r">
        <path class="fur" d="M33 11.500 L41.500 3.500 L42 17 Z" />
        <path class="pink" d="M35.400 11.200 L40.100 6.800 L40.400 14.200 Z" />
      </g>
      <path class="fur" d="M19 20 C19 14 24 10.500 31 10.500 C38 10.500 43 14 43 20 C43 23 44.500 26 46 28 C42.500 28.200 41 29.500 39.500 31 C37 33.400 34 34.200 31 34.200 C28 34.200 25 33.400 22.500 31 C21 29.500 19.500 28.200 16 28 C17.500 26 19 23 19 20 Z" />
      <path class="tex" d="M29.400 12.600 L30 14.400 M31 12.200 L31 14.200 M32.600 12.600 L32 14.400 M18.200 27.400 L20.200 27.200 M43.800 27.400 L41.800 27.200" />
      <g class="calm">
        <g class="eyes-nap">
          <g class="eyes">
            <circle class="iris" cx="25.200" cy="20.600" r="4.400" /><circle class="iris" cx="36.800" cy="20.600" r="4.400" />
            <g class="pupils">
              <circle class="pupil" cx="25.200" cy="20.600" r="2.700" /><circle class="pupil" cx="36.800" cy="20.600" r="2.700" />
              <circle class="shine" cx="26.300" cy="19.400" r="0.900" /><circle class="shine" cx="37.900" cy="19.400" r="0.900" />
              <circle class="shine" cx="24.300" cy="21.800" r="0.400" /><circle class="shine" cx="35.900" cy="21.800" r="0.400" />
            </g>
          </g>
        </g>
        <path class="lids" d="M21 21 Q25.200 24 29.400 21 M32.600 21 Q36.800 24 41 21" />
        <path class="mouth" d="M31 27.600 L31 28.600 M28.800 28.400 Q29.900 29.900 31 28.600 Q32.100 29.900 33.200 28.400" />
      </g>
      <g class="grin">
        <path class="happy" d="M21.400 22 Q25.200 17.400 29 22 M33 22 Q36.800 17.400 40.600 22" />
        <circle class="blush" cx="21.600" cy="26.400" r="2" /><circle class="blush" cx="40.400" cy="26.400" r="2" />
        <path class="maw" d="M27.600 28 Q31 34.400 34.400 28 Q31 29.400 27.600 28 Z" />
        <path class="pink" d="M29.400 30.600 Q31 32.600 32.600 30.600 Q31 30 29.400 30.600 Z" />
      </g>
      <path class="nose" d="M29.400 25.600 L32.600 25.600 L31 27.600 Z" />
      <path class="whisker" d="M24 26.500 L12.500 25 M24 28 L13 29.500 M24.200 29.400 L14.500 33 M38 26.500 L49.500 25 M38 28 L49 29.500 M37.800 29.400 L47.500 33" />
    </g>
    <text class="zz" x="46" y="9">z</text>
  </svg>
</template>

<style scoped>
.catfig {
  --cat-fur: color-mix(in oklab, var(--md-sys-color-scrim, #000) 84%, var(--md-sys-color-tertiary, #7d5260));
  --cat-tex: color-mix(in oklab, var(--cat-fur) 72%, #fff);
  --cat-eye: color-mix(in oklab, #ffd23f 88%, var(--md-sys-color-primary, #6750a4));
  --cat-pupil: color-mix(in oklab, #000 90%, var(--cat-eye));
  --cat-pink: color-mix(in oklab, #ff8fb1 82%, var(--md-sys-color-tertiary, #7d5260));
  --cat-grey: color-mix(in oklab, #aaa4b0 85%, var(--md-sys-color-outline, #79747e));
  --cat-whisker: color-mix(in oklab, #fff 80%, var(--md-sys-color-outline-variant, #cac4d0));
  display: block; width: 100%; height: 100%; overflow: visible;
}
/* night: a soft rim light (moonlight from the theme) around the black silhouette */
html[data-theme='dark'] .catfig {
  filter: drop-shadow(0 0 0.6px color-mix(in oklab, var(--md-sys-color-on-surface, #e6e1e5) 80%, transparent))
    drop-shadow(0 0 2.500px color-mix(in oklab, var(--md-sys-color-primary, #d0bcff) 40%, transparent));
}
.fur { fill: var(--cat-fur); }
.leg { fill: none; stroke: var(--cat-fur); stroke-width: 4.200; stroke-linecap: round; }
.leg.near { stroke-width: 4.600; }
.tail, .tail-base { fill: none; stroke: var(--cat-fur); stroke-width: 4.400; stroke-linecap: round; stroke-linejoin: round; }
.tex { fill: none; stroke: var(--cat-tex); stroke-width: 0.500; stroke-linecap: round; opacity: 0.55; }
.pink { fill: var(--cat-pink); }
.iris { fill: var(--cat-eye); }
.pupil { fill: var(--cat-pupil); }
.shine { fill: #fff; }
.nose { fill: var(--cat-grey); }
.mouth, .lids { fill: none; stroke: var(--cat-grey); stroke-width: 0.900; stroke-linecap: round; stroke-linejoin: round; }
.lids { stroke: var(--cat-eye); stroke-width: 1.300; }
.happy { fill: none; stroke: var(--cat-eye); stroke-width: 1.900; stroke-linecap: round; }
.blush { fill: var(--cat-pink); opacity: 0.5; }
.maw { fill: color-mix(in oklab, #7a1f33 85%, var(--cat-fur)); }
.whisker { fill: none; stroke: var(--cat-whisker); stroke-width: 0.450; stroke-linecap: round; opacity: 0.9; }
.zz { font: 600 9px/1 system-ui, sans-serif; fill: var(--cat-eye); }
/* every part pivots in the drawing's own coordinates, so hosts only set the motion */
.tail, .torso, .paw, .head, .ear-l, .ear-r, .eyes, .pupils, .eyes-nap, .lids, .zz { transform-box: view-box; }
.tail { transform-origin: 32.500px 62.300px; }
.torso { transform-origin: 34px 61px; }
.paw { transform-origin: 28.200px 43px; }
.head { transform-origin: 31px 33px; }
.ear-l { transform-origin: 24px 15px; }
.ear-r { transform-origin: 38px 15px; }
.eyes, .eyes-nap { transform-origin: 31px 20.600px; }
.pupils { transform: translate(var(--cat-look-x, 0px), var(--cat-look-y, 0px)); }
.zz { transform-origin: 47px 8px; }

/* still poses: sit (awake, calm face), grin (happy squint), nap (eyes shut, a z) */
.grin, .lids, .zz { opacity: 0; }
[data-pose='grin'] .grin { opacity: 1; }
[data-pose='grin'] .calm { opacity: 0; }
[data-pose='nap'] .eyes-nap { transform: scaleY(0.05); }
[data-pose='nap'] .lids, [data-pose='nap'] .zz { opacity: 1; }
</style>
