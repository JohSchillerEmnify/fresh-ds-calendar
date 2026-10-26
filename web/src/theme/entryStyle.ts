/**
 * The page's entry style (`solid`, `tinted` or `outline`) as one reactive value, written by `applyAttrs` for the page and
 * read by the time grid blocks (`EventItem.vue`), which need the style's border width to know their content width even
 * when the style changes without a resize (live theme preview). The first value comes from the cached theme attributes.
 */
import { shallowRef } from 'vue';

export type EntryStyle = 'solid' | 'tinted' | 'outline';

/** Left plus right border (px) of an entry in each style, as `theme.css` draws it (`--e-bw` both sides, `--e-bl` left). */
const BORDER_PX: Record<EntryStyle, number> = { solid: 0, tinted: 3, outline: 4 };

/**
 * The left plus right border of an entry in a style.
 *
 * @param style The entry style.
 * @returns The border width in px.
 */
export function entryBorderPx(style: EntryStyle): number {
  return BORDER_PX[style] ?? 0;
}

/** The cached style of the last session, `solid` (the default themes) when there is none. */
function cached(): EntryStyle {
  try {
    const v = JSON.parse(localStorage.getItem('cal.themeAttrs') ?? 'null')?.entries;
    return v === 'tinted' || v === 'outline' ? v : 'solid';
  } catch { return 'solid'; }
}

export const entryStyle = shallowRef<EntryStyle>(cached());
