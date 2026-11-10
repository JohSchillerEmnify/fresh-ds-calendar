/**
 * The icon set in use (`outlined`, `rounded`, `sharp`, `solar`, `phosphor` or `pixelart`) as one reactive value, written by `applyAttrs` and read by the
 * app's icon components (`components/icons.ts`). The first value comes from the cached theme attributes, so the icons are
 * right on the first paint.
 */
import { shallowRef } from 'vue';
import type { ThemeIcons } from '@calendar/shared';
import { ICON_SETS } from './fine';

export type IconSet = ThemeIcons;

/** The cached set of the last session, `outlined` (today's icons) when there is none. */
function cached(): IconSet {
  try {
    const v = JSON.parse(localStorage.getItem('cal.themeAttrs') ?? 'null')?.icons;
    return ICON_SETS.includes(v) ? v : 'outlined';
  } catch { return 'outlined'; }
}

export const iconSet = shallowRef<IconSet>(cached());
