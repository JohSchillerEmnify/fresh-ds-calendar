/** Item search feature (feature item-search): the search sheet, opened from the top bar as the dialog `item-search`. Registered once from extensions/builtin.ts. */
import { registerDialog } from '@/extensions/registry';

let done = false;
export function registerSearchFeature(): void {
  if (done) return;
  done = true;
  registerDialog('item-search', () => import('./ItemSearchSheet.vue'));
}
