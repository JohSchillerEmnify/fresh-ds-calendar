<script setup lang="ts">
import Pressable from '@/components/m3/Pressable.vue';
import { IconDownload, IconIosShare as IconShare } from '@/components/icons';
import Button from '@/components/m3/Button.vue';

import { canInstall, dismissIosHint, promptInstall, showIosHint } from '@/pwa/install';
import { t } from '@/i18n';
defineProps<{ part: 'button' | 'hint' }>();
</script>

<template>
  <Button v-if="part === 'button' && canInstall" variant="tonal" data-testid="install-app-button" @click="promptInstall"><template #icon><IconDownload /></template>{{ t('calendar.install.button') }}</Button>
  <div v-if="part === 'hint' && showIosHint" class="hint" role="note" data-testid="ios-install-hint">
    <IconShare class="ico" aria-hidden="true" />
    <span>{{ t('calendar.install.iosHint') }}</span>
    <Pressable type="button" class="x" :aria-label="t('calendar.actions.dismiss')" data-testid="ios-install-hint-dismiss" @click="dismissIosHint">✕</Pressable>
  </div>
</template>

<style scoped>
.hint { display: flex; align-items: center; gap: 12px; margin: 8px 12px; padding: 4px 4px 4px 16px; min-height: 52px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); font: var(--md-sys-typescale-body-medium); }
.hint span { flex: 1; }
.ico { width: 22px; height: 22px; }
.x { width: 44px; height: 44px; border-radius: 50%; }
</style>
