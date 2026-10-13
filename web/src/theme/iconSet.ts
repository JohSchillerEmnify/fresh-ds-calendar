/**
 * The icon set in use (`outlined`, `rounded` or `sharp`) as one reactive value, written by `applyAttrs` and read by the
 * app's icon components (`components/icons.ts`). The first value comes from the cached theme attributes, so the icons are
 * right on the first paint.
 */
import { shallowRef } from 'vue';

export type IconSet = 'outlined' | 'rounded' | 'sharp';

/** The cached set of the last session, `outlined` (today's icons) when there is none. */
function cached(): IconSet {
  try {
    const v = JSON.parse(localStorage.getItem('cal.themeAttrs') ?? 'null')?.icons;
    return v === 'rounded' || v === 'sharp' ? v : 'outlined';
  } catch { return 'outlined'; }
}

export const iconSet = shallowRef<IconSet>(cached());
