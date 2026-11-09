/** Keyboard, focus and dismissal behaviour shared by the menus (`OverflowMenu`, `Menu`): arrows, Home/End, Tab, Escape, focus leaving, press outside, scroll and resize. */
import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';
import { listen, type Disposer } from '@/lib/timers';

export interface MenuNavOptions {
  /** Whether the menu is showing. */
  open: () => boolean;
  /** The menu panel; its `[role="menuitem"]` children are the items. */
  panel: Ref<HTMLElement | null>;
  /** The button that opened the menu (focus returns to it; it counts as inside). */
  trigger?: Ref<HTMLElement | null>;
  /** Called to dismiss; `refocus` asks to give focus back to the trigger. */
  close: (refocus: boolean) => void;
  /** Dismiss on any scroll and on resize (for a menu placed once, in fixed coordinates). */
  closeOnMove?: boolean;
  /** CSS selector of the items inside the panel (default menu items; a listbox passes its options). */
  itemSelector?: string;
  /** Item that gets the focus on opening when present (a listbox's chosen option), else the first item. */
  preferSelector?: string;
}

/** The index to focus after `key` from item `at` of `count` (-1: none focused); null when the key moves nothing. */
function nextIndex(key: string, at: number, count: number): number | null {
  if (!count) return null;
  if (key === 'ArrowDown') return (at + 1) % count;
  if (key === 'ArrowUp') return at < 0 ? count - 1 : (at - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** Wires a menu: returns the `keydown` handler to put on the panel (and the trigger); the outside listeners live while it is open. */
export function useMenuNav(o: MenuNavOptions): { onKey: (e: KeyboardEvent) => void } {
  const items = (): HTMLElement[] => [...(o.panel.value?.querySelectorAll<HTMLElement>(o.itemSelector ?? '[role="menuitem"]') ?? [])];
  const inside = (n: Node | null): boolean => !!n && (!!o.panel.value?.contains(n) || !!o.trigger?.value?.contains(n));

  function onKey(e: KeyboardEvent): void {
    if (!o.open()) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); o.close(true); return; }
    // Tab leaves the menu: focus returns to the trigger and the browser moves on from there
    if (e.key === 'Tab') { o.close(true); return; }
    const list = items();
    const to = nextIndex(e.key, list.indexOf(document.activeElement as HTMLElement), list.length);
    if (to === null) return;
    e.preventDefault();
    list[to].focus();
  }

  let stops: Disposer[] = [];
  watch(o.open, async (isOpen) => {
    stops.forEach((s) => s());
    stops = [];
    if (!isOpen) return;
    await nextTick();
    // closed again while waiting
    if (!o.open()) return;
    const preferred = o.preferSelector ? o.panel.value?.querySelector<HTMLElement>(o.preferSelector) : null;
    (preferred ?? items()[0])?.focus({ preventScroll: true });
    stops.push(
      listen(document, 'pointerdown', (e) => { if (!inside(e.target as Node)) o.close(false); }, { capture: true }),
      listen(document, 'focusin', (e) => { if (!inside(e.target as Node)) o.close(false); }),
    );
    if (o.closeOnMove) {
      // iOS scrolls a little on a tap; only a scroll that really moves the button leaves the fixed card behind
      const at = o.trigger?.value?.getBoundingClientRect();
      const moved = () => { const r = o.trigger?.value?.getBoundingClientRect(); return !at || !r || Math.abs(r.top - at.top) > 2 || Math.abs(r.left - at.left) > 2; };
      stops.push(
        listen(document, 'scroll', (e) => { if (!o.panel.value?.contains(e.target as Node) && moved()) o.close(false); }, { capture: true, passive: true }),
        listen(window, 'resize', () => o.close(false)),
      );
    }
  });
  onBeforeUnmount(() => stops.forEach((s) => s()));
  return { onKey };
}
