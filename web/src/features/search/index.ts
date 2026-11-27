/** Item search feature (feature item-search): the search sheet, opened from the top bar as the dialog `item-search`. Registered once from extensions/builtin.ts. */
import { watch } from 'vue';
import { registerDialog } from '@/extensions/registry';
import { useDeviceStore } from '@/stores/device';

let done = false;
export function registerSearchFeature(): void {
  if (done) return;
  done = true;
  registerDialog('item-search', () => import('./ItemSearchSheet.vue'));
  // once the device copy is there the index is built while the page is idle: the first search then answers at once
  const device = useDeviceStore();
  watch(() => !!device.data, (has) => {
    if (!has) return;
    const warm = (): void => { void import('./useItemSearch').then((m) => m.warmItemSearchIndex()); };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 5_000 });
    else setTimeout(warm, 2_000);
  }, { immediate: true });
}
