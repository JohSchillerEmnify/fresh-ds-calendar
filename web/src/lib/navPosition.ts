import type { NavPosition } from '@/api/types';

/** The values of the person prefs `navPhone` and `navDesktop`, in the order the settings offer them. */
export const NAV_POSITIONS: readonly NavPosition[] = ['bottom', 'top', 'rail'];

/**
 * Picks the position of the view switcher for the current layout: phones use `navPhone`, everything else (desktop and
 * touch tablets, >= 768 px) uses `navDesktop` (feature nav-position).
 */
export function resolveNavPosition(phone: boolean, prefs: { navPhone: NavPosition; navDesktop: NavPosition }): NavPosition {
  return phone ? prefs.navPhone : prefs.navDesktop;
}

/**
 * The side the rail sits on. A phone's rail is on the thumb side (right, left in left-handed mode); a desktop or
 * tablet rail stays at the left.
 */
export function railSide(phone: boolean, leftHanded: boolean): 'left' | 'right' {
  return phone && !leftHanded ? 'right' : 'left';
}
