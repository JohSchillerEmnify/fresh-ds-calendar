<script setup lang="ts">
import { computed, ref } from 'vue';
import { ApiError } from '@/api/client';
import { GOOGLE_COLORS, isHexColor } from '@/api/colors';
import type { Category } from '@/api/types';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import TextField from '@/components/m3/TextField.vue';
import { t } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { googleColorLabel } from '@/theme/labels';

const props = defineProps<{ category?: Category }>();
const emit = defineEmits<{ close: [] }>();
const settings = useSettingsStore();

const name = ref(props.category?.name ?? '');
const color = ref(props.category?.color ?? GOOGLE_COLORS[9].hex);
const icon = ref(props.category?.icon ?? '');
const error = ref('');
const saving = ref(false);
const confirming = ref(false);
const swatches = computed(() => GOOGLE_COLORS.map((c) => ({ value: c.hex, name: googleColorLabel(c), color: c.hex })));

async function run(fn: () => Promise<unknown>) {
  saving.value = true;
  error.value = '';
  try {
    await fn();
    emit('close');
  } catch (e) {
    error.value = e instanceof ApiError ? e.userMessage : t('theme.categoryDialog.failed');
  } finally {
    saving.value = false;
  }
}
function save() {
  if (!name.value.trim()) { error.value = t('theme.categoryDialog.nameRequired'); return; }
  if (!isHexColor(color.value)) { error.value = t('theme.fine.invalidColor'); return; }
  const body = { name: name.value.trim(), color: color.value.trim().toLowerCase(), icon: icon.value.trim() || null };
  void run(() => (props.category ? settings.updateCategory(props.category.id, body) : settings.addCategory(body)));
}
</script>

<template>
  <AdaptiveSheet :open="true" :label="category ? t('theme.categoryDialog.edit') : t('theme.categoryDialog.new')" testid="category-dialog" @close="emit('close')">
    <form class="f" novalidate @submit.prevent="save">
      <h2 class="t">{{ category ? t('theme.categoryDialog.edit') : t('theme.categoryDialog.new') }}</h2>
      <TextField v-model="name" :label="t('theme.categoryDialog.name')" data-testid="category-name" maxlength="40" autocomplete="off" />
      <ColorSwatchPicker :swatches="swatches" :model-value="color.toLowerCase()" :label="t('theme.categoryDialog.color')" @update:model-value="color = $event" />
      <TextField v-model="color" :label="t('theme.categoryDialog.colorHex')" data-testid="category-color" autocomplete="off" autocapitalize="off" />
      <TextField v-model="icon" :label="t('theme.categoryDialog.icon')" data-testid="category-icon" autocomplete="off" />
      <p v-if="error" class="err" role="alert" data-testid="category-error">{{ error }}</p>
      <div class="actions">
        <Button v-if="category" variant="text" class="del" data-testid="category-delete" @click="confirming = true">{{ t('theme.categoryDialog.delete') }}</Button>
        <span class="sp" />
        <Button variant="text" data-testid="category-cancel" @click="emit('close')">{{ t('theme.categoryDialog.cancel') }}</Button>
        <Button type="submit" :disabled="saving" data-testid="category-save">{{ t('theme.categoryDialog.save') }}</Button>
      </div>
    </form>
    <ConfirmDialog
      :open="confirming" :title="t('theme.categoryDialog.confirmTitle', { name: category?.name ?? '' })" :message="t('theme.categoryDialog.confirmMessage')"
      @cancel="confirming = false" @ok="confirming = false; run(() => settings.deleteCategory(category!.id))"
    />
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.err { margin: 0; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium); }
.actions { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.sp { flex: 1; }
.del { color: var(--md-sys-color-error); }
/* Left-handed mode (phone): the primary action is at the bottom left. */
@media (max-width: 767.98px) { html[data-hand='left'] .actions { flex-direction: row-reverse; } }
</style>
