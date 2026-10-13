<script setup lang="ts">
/**
 * Night band of the Approaching track: a dark stretch behind the track's entries where the night lies inside the
 * track's window, with a moon at bedtime and a sun at wake-up when those are on the track. Pointer events pass through.
 */
import { IconBedtime, IconSunny } from '@/components/icons';
import type { TrackBand } from './bedtime';
import { t } from '@/i18n';

defineProps<{ bands: TrackBand[]; offsetPx: number }>();
</script>

<template>
  <div class="bt" :style="{ left: offsetPx + 'px' }" aria-hidden="true">
    <div
      v-for="b in bands" :key="b.window.from" class="band" data-testid="bedtime-track-band" :data-from="b.window.from" :data-to="b.window.to"
      :style="{ left: b.left * 100 + '%', width: b.width * 100 + '%' }"
    >
      <span v-if="b.moon" class="mark moon" :title="t('bedtime.moon', { time: b.window.from.slice(11) })" data-testid="bedtime-moon"><IconBedtime /></span>
      <span v-if="b.sun" class="mark sun" :title="t('bedtime.sun', { time: b.window.to.slice(11) })" data-testid="bedtime-sun"><IconSunny /></span>
    </div>
  </div>
</template>

<style scoped>
.bt { position: absolute; right: 0; top: 0; bottom: 0; pointer-events: none; z-index: 0; }
.band { position: absolute; top: 0; bottom: 0; background: color-mix(in oklab, var(--md-sys-color-scrim, #000) 28%, transparent); border-radius: 4px; }
.mark { position: absolute; top: 13px; width: 16px; height: 16px; display: grid; place-items: center; border-radius: 50%; background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }
.mark :deep(svg) { width: 11px; height: 11px; }
.moon { left: 2px; }
.sun { right: 2px; }
</style>
