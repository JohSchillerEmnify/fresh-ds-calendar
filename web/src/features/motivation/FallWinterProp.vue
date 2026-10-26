<script setup lang="ts">
/**
 * One Fall or Winter prop of the top bar scene (feature theme-scenes, round 3 art from `fwart.cjs`): an autumn tree
 * (orange, red, amber and gold crown on a brown trunk), a leaf pile, a snowy bare tree, a snowman with a red scarf or a
 * sledge. Flat SVG drawn `h` px tall on the bar's bottom edge; the host places it. It stands still. `data-part` names it.
 */
import type { PropKind } from './fallWinter';

defineProps<{ kind: PropKind; h: number }>();

/** The snowy tree's branches; drawn twice: bark, then a dashed line of snow on top. */
const BRANCHES = 'M19.400 36 C15 32 11 30 7 24 M20.600 33 C25 29 29 27 33 21 M20 25 C17.500 21 15.500 17 13.500 11 M20 23 C22.500 19 24.500 15 26.500 9 M9.400 27.400 L5 28.400 M30.600 24.400 L35 25.200 M15 15.600 L11 14.800 M25 13.800 L29 12';
</script>

<template>
  <svg v-if="kind === 'autumn-tree'" class="fwp autumn-tree" data-part="autumn-tree" viewBox="0 0 40 50" :style="{ height: `${h}px` }" aria-hidden="true" focusable="false">
    <path class="bark" d="M17 50 C18.400 45 19 38 18.600 29 L21.400 29 C21 38 21.600 45 23 50 Z" />
    <path class="br" d="M19.400 35 C16 32 13 30 10.500 25.500 M20.600 33 C24 30 27 28 29.500 23.500 M20 30 L20 19" />
    <g class="crown">
      <circle class="c-deep" cx="11" cy="21.500" r="7.200" /><circle class="c-deep" cx="29" cy="21.500" r="7.200" />
      <circle class="c-mid" cx="20" cy="16" r="10" /><circle class="c-mid" cx="13.500" cy="11" r="6.600" /><circle class="c-mid" cx="26.500" cy="11" r="6.600" />
      <circle class="c-red" cx="20" cy="6.500" r="5.600" /><circle class="c-red" cx="8" cy="18" r="3.600" /><circle class="c-red" cx="31.500" cy="25" r="3.400" />
      <circle class="c-amber" cx="24.500" cy="15" r="4.600" /><circle class="c-amber" cx="12.500" cy="25" r="3.600" /><circle class="c-amber" cx="15" cy="9" r="3" />
      <circle class="c-gold" cx="26" cy="9" r="2.200" /><circle class="c-gold" cx="17.500" cy="18.500" r="2.400" /><circle class="c-gold" cx="31" cy="17" r="1.800" /><circle class="c-gold" cx="9" cy="23.500" r="1.500" />
    </g>
    <path class="br gap" d="M20 27 C19 24 18.500 22 18 20 M20.500 26 C22 24 23 23 24.200 22" />
  </svg>
  <svg v-else-if="kind === 'leaf-pile'" class="fwp leaf-pile" data-part="leaf-pile" viewBox="0 0 30 10" :style="{ height: `${h}px` }" aria-hidden="true" focusable="false">
    <path class="pile" d="M0 10 C2.500 5 8 2 15 2 C22 2 27.500 5 30 10 Z" />
    <ellipse class="l-or" cx="6" cy="7.400" rx="2.600" ry="1.200" transform="rotate(-25 6 7.400)" />
    <ellipse class="l-gold" cx="11" cy="4.400" rx="2.600" ry="1.200" transform="rotate(20 11 4.400)" />
    <ellipse class="l-red" cx="15.500" cy="3" rx="2.400" ry="1.100" transform="rotate(-10 15.500 3)" />
    <ellipse class="l-or" cx="20" cy="4.600" rx="2.600" ry="1.200" transform="rotate(35 20 4.600)" />
    <ellipse class="l-gold" cx="25" cy="7.600" rx="2.400" ry="1.100" transform="rotate(-30 25 7.600)" />
    <ellipse class="l-red" cx="9.500" cy="8" rx="2.200" ry="1" transform="rotate(10 9.500 8)" />
    <ellipse class="l-gold" cx="17" cy="7" rx="2.400" ry="1.100" transform="rotate(-40 17 7)" />
    <ellipse class="l-red" cx="22.500" cy="8.600" rx="2.200" ry="1" transform="rotate(15 22.500 8.600)" />
  </svg>
  <svg v-else-if="kind === 'snowy-tree'" class="fwp snowy-tree" data-part="snowy-tree" viewBox="0 0 40 50" :style="{ height: `${h}px` }" aria-hidden="true" focusable="false">
    <path class="wbark" d="M18 50 C18.800 44 19 38 19 30 C19 25 19.400 21 20 16 C20.600 21 21 25 21 30 C21 38 21.200 44 22 50 Z" />
    <path class="wbr" :d="`${BRANCHES} M20 18 L20 8`" />
    <path class="cap" :d="BRANCHES" />
    <ellipse class="lump" cx="20" cy="30.600" rx="2.400" ry="1" />
  </svg>
  <svg v-else-if="kind === 'snowman'" class="fwp snowman" data-part="snowman" viewBox="0 0 26 32" :style="{ height: `${h}px` }" aria-hidden="true" focusable="false">
    <path class="arm" d="M8.400 16 L2.600 11.400 M4.600 13 L3.400 10.600 M17.600 16 L23.400 11.600 M21.400 13.200 L23.200 10.400" />
    <circle class="ball" cx="13" cy="25.200" r="6.800" /><circle class="ball" cx="13" cy="16.400" r="5.200" /><circle class="ball" cx="13" cy="8.600" r="3.900" />
    <path class="scarf" d="M9.200 11.600 C11.600 12.800 14.400 12.800 16.800 11.600 L16.800 13.200 C14.400 14.300 11.600 14.300 9.200 13.200 Z M14.200 13.400 L16.200 13 L16.600 17.400 L14.800 17.600 Z" />
    <rect class="hat" x="8.800" y="4.200" width="8.400" height="1.300" rx="0.500" /><rect class="hat" x="10.200" y="0.400" width="5.600" height="4.200" rx="0.500" />
    <rect class="band" x="10.200" y="3.200" width="5.600" height="0.900" />
    <circle class="coal" cx="11.600" cy="7.900" r="0.600" /><circle class="coal" cx="14.400" cy="7.900" r="0.600" />
    <path class="nose" d="M13 9 L17 9.900 L13 10.500 Z" />
    <circle class="coal" cx="13" cy="16" r="0.550" /><circle class="coal" cx="13" cy="18.400" r="0.550" /><circle class="coal" cx="13" cy="23.400" r="0.600" />
  </svg>
  <svg v-else class="fwp sledge" data-part="sledge" viewBox="0 0 34 13" :style="{ height: `${h}px` }" aria-hidden="true" focusable="false">
    <path class="runner" d="M1 11.600 L28 11.600 C31.400 11.600 33.200 10 33 7.200" />
    <path class="runner" d="M6 8 L6 11.600 M16 8 L16 11.600 M25 8 L25 11.600" />
    <rect class="seat" x="2.600" y="4.600" width="25.400" height="3.600" rx="1.200" />
    <path class="rope" d="M28 6.200 C31 3 33.400 4 33 7.200" />
  </svg>
</template>

<style scoped>
.fwp { position: absolute; bottom: 0; width: auto; display: block; overflow: visible; }
.autumn-tree { --bark: color-mix(in oklab, var(--md-sys-color-on-surface, #1d1b20) 30%, #7a4a1e); }
.bark { fill: var(--bark); }
.br { fill: none; stroke: var(--bark); stroke-width: 1.500; stroke-linecap: round; }
.br.gap { stroke-width: 1; }
.c-deep { fill: #b8401a; }
.c-mid { fill: #e0661c; }
.c-red { fill: #c0392b; }
.c-amber { fill: #f08c22; }
.c-gold { fill: #f6bd3b; }
html[data-theme='dark'] .crown, html[data-theme='dark'] .leaf-pile { filter: brightness(0.9); }
.pile { fill: #a8461c; }
.l-or { fill: #e8761f; }
.l-gold { fill: #f2b134; }
.l-red { fill: #c0392b; }
.snowy-tree { --wb: color-mix(in oklab, var(--md-sys-color-on-surface, #1d1b20) 35%, #7d6656); }
html[data-theme='dark'] .snowy-tree { --wb: #8c786a; }
.wbark { fill: var(--wb); }
.wbr { fill: none; stroke: var(--wb); stroke-width: 1.700; stroke-linecap: round; }
.cap { fill: none; stroke: #fbfdff; stroke-width: 0.800; stroke-linecap: round; translate: 0 -0.900px; stroke-dasharray: 6 2.500; }
.lump { fill: #fbfdff; }
html:not([data-theme='dark']) .snowy-tree :is(.cap, .lump) { filter: drop-shadow(0 0.300px 0 #8fa6bd); }
.ball { fill: #fbfdff; stroke: #9db3c9; stroke-width: 0.600; }
html[data-theme='dark'] .ball { fill: #e9f1f9; stroke: #c9d8e8; stroke-width: 0.400; }
.arm { fill: none; stroke: #6d4c2f; stroke-width: 0.900; stroke-linecap: round; }
html[data-theme='dark'] .arm { stroke: #a07c5a; }
.scarf, .band { fill: #d32f2f; }
.hat { fill: #26262b; }
html[data-theme='dark'] .hat { fill: #3a3a44; stroke: #9aa3b5; stroke-width: 0.300; }
.coal { fill: #26262b; }
.nose { fill: #f08a24; }
.runner { fill: none; stroke: #5a3a22; stroke-width: 1.400; stroke-linecap: round; }
html[data-theme='dark'] .runner { stroke: #a8835f; }
.seat { fill: #c0392b; }
.rope { fill: none; stroke: #d9b38a; stroke-width: 0.700; }
</style>
