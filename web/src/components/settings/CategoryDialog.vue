<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/client';
import { GOOGLE_COLORS, isHexColor } from '@/api/colors';
import type { Category } from '@/api/types';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import ShareAddressField from './ShareAddressField.vue';
import { useAuthStore } from '@/stores/auth';
import { useInvitationsStore } from '@/stores/invitations';
import TextField from '@/components/m3/TextField.vue';
import { useAsyncSubmit } from '@/composables/useAsyncSubmit';
import { t } from '@/i18n';
import { useDeviceStore } from '@/stores/device';
import { useSyncStore } from '@/stores/sync';
import { useSettingsStore } from '@/stores/settings';
import { googleColorLabel } from '@/theme/labels';

const props = defineProps<{ category?: Category }>();
const emit = defineEmits<{ close: [] }>();
const settings = useSettingsStore();
const device = useDeviceStore();

const name = ref(props.category?.name ?? '');
const color = ref(props.category?.color ?? GOOGLE_COLORS[9].hex);
const icon = ref(props.category?.icon ?? '');
let stayOpen = false;
const { busy: saving, error, run: submit } = useAsyncSubmit({ onDone: () => { if (stayOpen) stayOpen = false; else emit('close'); } });
const run = (fn: () => Promise<unknown>) => submit(fn, 'theme.categoryDialog.failed');
const confirming = ref(false);
/** "Share with" (feature shared-lists): the address of the person this category's lists are shared with, '' = nobody. */
const auth = useAuthStore();
const sharedWith = ref('');
let sharedBefore = '';
const invitations = useInvitationsStore();
const pending = computed(() => (props.category ? invitations.sentFor('category', props.category.id) : null));
onMounted(async () => {
  if (!props.category) return;
  void invitations.refresh();
  try {
    const s = await device.read('categoryShares', () => api.categoryShares());
    sharedWith.value = sharedBefore = s.shares[props.category.id]?.email ?? '';
  } catch { /* the field starts empty */ }
});
const swatches = computed(() => GOOGLE_COLORS.map((c) => ({ value: c.hex, name: googleColorLabel(c), color: c.hex })));

function save() {
  if (!name.value.trim()) { error.value = t('theme.categoryDialog.nameRequired'); return; }
  if (!isHexColor(color.value)) { error.value = t('theme.fine.invalidColor'); return; }
  const body = { name: name.value.trim(), color: color.value.trim().toLowerCase(), icon: icon.value.trim() || null };
  void run(async () => {
    if (!props.category) return settings.addCategory(body);
    await settings.updateCategory(props.category.id, body);
    const typed = sharedWith.value.trim().toLowerCase();
    if (typed === sharedBefore) return;
    // a typed address sends an invitation; an empty field stops sharing, which moves the lists back with new ids
    const answer = await api.shareCategory(props.category.id, typed || null);
    device.putFile('categoryShares', answer);
    await invitations.refresh();
    void useSyncStore().resyncAfterWrite();
  });
}

const withdraw = () => run(async () => {
  await invitations.respond(pending.value!.id, 'withdraw');
  stayOpen = true;
});
</script>

<template>
  <AdaptiveSheet :open="true" :label="category ? t('theme.categoryDialog.edit') : t('theme.categoryDialog.new')" testid="category-dialog" @close="emit('close')">
    <form class="f" novalidate @submit.prevent="save">
      <h2 class="t">{{ category ? t('theme.categoryDialog.edit') : t('theme.categoryDialog.new') }}</h2>
      <TextField v-model="name" :label="t('theme.categoryDialog.name')" data-testid="category-name" maxlength="40" autocomplete="off" />
      <ColorSwatchPicker :swatches="swatches" :model-value="color.toLowerCase()" :label="t('theme.categoryDialog.color')" @update:model-value="color = $event" />
      <TextField v-model="color" :label="t('theme.categoryDialog.colorHex')" data-testid="category-color" autocomplete="off" autocapitalize="off" />
      <TextField v-model="icon" :label="t('theme.categoryDialog.icon')" data-testid="category-icon" autocomplete="off" />
      <template v-if="category && auth.status !== 'off'">
        <div v-if="pending" class="pend">
          <p class="who" data-testid="category-share-who">{{ t('sharing.invite.sent', { address: pending.address }) }}</p>
          <Button variant="tonal" :disabled="saving" data-testid="category-invite-withdraw" @click="withdraw">{{ t('sharing.invite.withdraw') }}</Button>
        </div>
        <template v-else>
          <ShareAddressField v-model="sharedWith" data-testid="category-share-person" />
          <p class="hint">{{ t('sharing.category.hint') }}</p>
        </template>
      </template>
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
.hint { margin: -6px 0 0; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-body-small); }
.pend { display: flex; gap: 10px; align-items: center; }
.who { flex: 1; margin: 0; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-body-medium); }
.err { margin: 0; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium); }
.actions { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.sp { flex: 1; }
.del { color: var(--md-sys-color-error); }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
