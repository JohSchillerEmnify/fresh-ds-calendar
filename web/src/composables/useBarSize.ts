import { computed } from 'vue';
import { usePrefsStore } from '@/stores/prefs';
import { isPhone } from './useViewport';

/** A bar size as drawn: Expressive (the taller, labelled one) or Compact. */
export type ResolvedBarSize = 'expressive' | 'compact';

/** Settles a stored size choice: `auto` is Compact on phones and Expressive on wider screens (features nav-expressive, header-expressive). */
export function resolveBarSize(choice: 'auto' | 'expressive' | 'compact', phone: boolean): ResolvedBarSize {
  if (choice === 'auto') return phone ? 'compact' : 'expressive';
  return choice;
}

/** The top bar's size from the `headerLayout` pref (`two-rows` is Expressive, `one-row` Compact, `auto` by screen). */
export function topBarSizeOf(layout: 'auto' | 'two-rows' | 'one-row', phone: boolean): ResolvedBarSize {
  return resolveBarSize(layout === 'two-rows' ? 'expressive' : layout === 'one-row' ? 'compact' : 'auto', phone);
}

/** The top bar's and the bottom bar's size now, from the person's two size prefs and the screen. */
export function useBarSize() {
  const prefs = usePrefsStore();
  const top = computed(() => topBarSizeOf(prefs.headerLayout, isPhone.value));
  const bottom = computed(() => resolveBarSize(prefs.bottomBarSize, isPhone.value));
  return { top, bottom };
}
