<script setup lang="ts">
/** Step-by-step "Add to Home Screen" instructions: iOS cannot install a PWA programmatically. */
import { IconIosShare as IconShare } from '@/components/icons';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import { t } from '@/i18n';

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <AdaptiveSheet :open="true" :label="t('settings.account.installApp.title')" testid="ios-install-sheet" @close="emit('close')">
    <div class="f">
      <h2 class="t">{{ t('settings.account.installApp.title') }}</h2>
      <ol class="steps">
        <li><IconShare class="ico" aria-hidden="true" /><span data-testid="ios-install-step">{{ t('settings.account.installApp.step1') }}</span></li>
        <li><span class="n" aria-hidden="true">2</span><span data-testid="ios-install-step">{{ t('settings.account.installApp.step2') }}</span></li>
        <li><span class="n" aria-hidden="true">3</span><span data-testid="ios-install-step">{{ t('settings.account.installApp.step3') }}</span></li>
      </ol>
      <div class="actions"><Button data-testid="ios-install-close" @click="emit('close')">{{ t('settings.account.installApp.close') }}</Button></div>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; font: var(--md-sys-typescale-body-large); }
.steps li { display: flex; align-items: center; gap: 16px; min-height: 40px; }
.ico, .n { flex: none; width: 32px; height: 32px; padding: 4px; box-sizing: border-box; border-radius: 50%; background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.n { display: grid; place-items: center; font: var(--md-sys-typescale-label-large); }
.actions { display: flex; justify-content: flex-end; margin-top: 4px; }
html[data-hand='left'] .actions { justify-content: flex-start; }
</style>
