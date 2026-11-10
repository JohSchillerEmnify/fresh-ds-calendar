<script setup lang="ts">
/** The credits: every library, icon set or asset the app ships whose licence asks for attribution (name, author, licence, link). */
import { onMounted, ref } from 'vue';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import { loadCredits } from '@/credits/load';
import type { Credit } from '@/credits/types';
import { t } from '@/i18n';

const emit = defineEmits<{ close: [] }>();
const credits = ref<Credit[]>([]);
/** The link as host and owner/repo only; the full address is the href. */
const shortUrl = (u: string) => u.replace(/^https?:\/\//, '').split('/').slice(0, 3).join('/');
onMounted(async () => { credits.value = await loadCredits(); });
</script>

<template>
  <AdaptiveSheet :open="true" :label="t('settings.account.credits.title')" testid="credits-sheet" @close="emit('close')">
    <div class="f">
      <h2 class="t">{{ t('settings.account.credits.title') }}</h2>
      <p class="intro">{{ t('settings.account.credits.intro') }}</p>
      <ul class="list">
        <li v-for="c in credits" :key="c.name" class="item" data-testid="credit" :data-credit="c.name">
          <span class="name">{{ c.name }}</span>
          <span class="meta" data-testid="credit-meta">{{ [c.author, c.license].filter(Boolean).join(' · ') }}</span>
          <a v-if="c.url" class="link" :href="c.url" target="_blank" rel="noopener noreferrer" data-testid="credit-link">{{ shortUrl(c.url) }}</a>
        </li>
      </ul>
      <div class="actions"><Button data-testid="credits-close" @click="emit('close')">{{ t('settings.account.credits.close') }}</Button></div>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.intro { margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.item { display: flex; flex-direction: column; padding: 10px 16px; background: var(--md-sys-color-surface-container); }
.item:first-child { border-radius: 16px 16px 4px 4px; }
.item:last-child { border-radius: 4px 4px 16px 16px; }
.name { font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); overflow-wrap: anywhere; }
.meta { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.link { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-primary); overflow-wrap: anywhere; }
.actions { display: flex; justify-content: flex-end; margin-top: 4px; }
html[data-hand='left'] .actions { justify-content: flex-start; }
</style>
