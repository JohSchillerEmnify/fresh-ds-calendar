<script setup lang="ts">
/** The view switcher as a tabs row under the top app bar (position `top`); same tab markup as the bar and the rail. */
import type { NavItem } from './types';
import { t } from '@/i18n';
import { vRipple } from '@/lib/ripple';

defineProps<{ items: NavItem[]; modelValue: string }>();
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <nav class="nav-tabs" data-testid="nav-tabs" :aria-label="t('nav.views')">
    <div class="tabs" role="tablist" data-testid="view-switcher" data-position="top">
      <button
        v-for="it in items" :key="it.id" v-ripple class="dest" role="tab" type="button"
        :aria-selected="it.id === modelValue" :class="{ active: it.id === modelValue }" :data-testid="it.testid" :data-experimental="it.experimental ? 'true' : undefined"
        @click="$emit('update:modelValue', it.id)"
      >
        <span class="lbl">{{ it.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.nav-tabs { flex: none; background: var(--md-sys-color-surface); border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.tabs { display: flex; min-height: 48px; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.dest {
  flex: 1 0 auto; min-width: 44px; min-height: 48px; padding: 0 16px; position: relative; display: flex; align-items: center; justify-content: center;
  color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-title-small);
}
.active { color: var(--md-sys-color-primary); }
/* Fade only INTO the active state, like the bottom bar: the previously active tab must not animate. */
.dest::after {
  content: ''; position: absolute; left: 16px; right: 16px; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--md-sys-color-primary);
  transform: scaleX(0); transition: none;
}
.active::after { transform: scaleX(1); transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); }
</style>
