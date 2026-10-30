/**
 * Keeps scene parts from being drawn under a control of the top bar (feature theme-scenes: "no prop is ever under a
 * control"). The Fall and Winter spots come from mockups at fixed widths; on another width, with a longer title or in
 * today's left-handed bar a prop or a resting particle could land under the title, a button or the Today pill. Such a
 * part is left out (hidden), never shrunk, as the Easter hare is. Measures only when the bar or its controls change
 * size or content, never on a timer.
 */
import { onMounted, onScopeDispose, type Ref } from 'vue';

/** The controls' drawn parts: the title text and chevron, the arrows, the Today pill, the widgets and the buttons. */
const CONTROLS = [
  '[data-testid=period-title] .t', '[data-testid=period-title] > svg', '[data-testid=tasks-title] .t', '[data-testid=view-title] .t',
  '[data-testid=nav-prev] svg', '[data-testid=nav-next] svg', '[data-testid=nav-today]', '[data-testid=streak-flame]', '[data-testid=plant-button]',
  '[data-testid=sync-status] svg', '[data-testid=filter-button] svg', '[data-testid=settings-button] svg',
].join(', ');

interface Box { l: number; r: number; t: number; b: number }

/** The drawn box of a control: an icon's shapes rather than its square, otherwise the element. */
function drawnBox(el: Element): Box | null {
  const shapes = el.tagName.toLowerCase() === 'svg' ? [...el.querySelectorAll('path, circle, rect, ellipse')] : [];
  const rects = (shapes.length ? shapes : [el]).map((s) => s.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length || getComputedStyle(el).visibility === 'hidden') return null;
  return { l: Math.min(...rects.map((r) => r.left)), r: Math.max(...rects.map((r) => r.right)), t: Math.min(...rects.map((r) => r.top)), b: Math.max(...rects.map((r) => r.bottom)) };
}

/** The nearest positioned ancestor (an svg has no `offsetParent`): the box a part's `left` is measured from. */
function containingBlock(el: Element): Element | null {
  for (let a = el.parentElement; a; a = a.parentElement) if (getComputedStyle(a).position !== 'static') return a;
  return null;
}

/**
 * Marks every element under `root` matching `selector` whose box intersects a control of the top bar `root` sits in
 * with `data-hidden` (the host's CSS hides it, keeping its box, so it is measured again on the next check).
 * A part that would reach above the bar is marked too. A part with `data-line="<selector>"` is also judged by points
 * along that path (inside `root`), e.g. the kite's string. `active()` false clears the marks (e.g. particles while they drift). Returns a function that measures again on the
 * next frame.
 *
 * @param root - The scene element holding the parts; outside a top bar nothing is hidden.
 * @param selector - The parts to keep clear (CSS selector, matched inside `root`).
 * @param active - Whether the parts are checked now.
 * @param movable - Parts (CSS selector, a subset of `selector`) that are first moved, at full size, to the nearest free
 *   horizontal spot (their CSS reads `--clear-x`) and left out only when no spot is free: the scene's characters.
 */
export function useClearOfControls(root: Ref<HTMLElement | null>, selector: string, active: () => boolean = () => true, movable = ''): () => void {
  let frame = 0;
  let disposed = false;
  let resize: ResizeObserver | null = null;
  let mutate: MutationObserver | null = null;

  const check = () => {
    const el = root.value;
    if (!el) return;
    const parts = [...el.querySelectorAll<HTMLElement | SVGElement>(selector)];
    if (disposed) return;
    const bar = el.closest('[data-testid="top-bar"]');
    const on = !!bar && active();
    const controls = on ? [...bar.querySelectorAll(CONTROLS)].map(drawnBox).filter((b): b is Box => !!b) : [];
    // a part reaching above the bar would be cut: it is left out as well
    const top = bar?.getBoundingClientRect().top ?? 0;
    const judge = (p: HTMLElement | SVGElement) => {
      // a drawing is judged by its shapes (a tree's crown, not the drawing's square), like the controls
      const shapes = p.tagName.toLowerCase() === 'svg' ? [...p.querySelectorAll('path, circle, rect, ellipse')] : [p];
      const hits = (r: Box) => controls.some((c) => Math.min(r.r, c.r) - Math.max(r.l, c.l) > 0 && Math.min(r.b, c.b) - Math.max(r.t, c.t) > 0);
      const boxes = shapes.map((s) => { const r = s.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
      // a line drawn with the part (the kite's string) is judged by points along it, not by its large box
      const line = p.dataset.line ? el.querySelector<SVGPathElement>(p.dataset.line) : null;
      const m = line?.getScreenCTM();
      if (line && m) {
        const len = line.getTotalLength();
        for (let i = 0; i <= 24; i++) {
          const q = line.getPointAtLength((len * i) / 24), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
          boxes.push({ l: x - 0.4, r: x + 0.4, t: y - 0.4, b: y + 0.4 });
        }
      }
      return on && boxes.some((r) => hits(r) || r.t < top - 0.5);
    };
    /** The nearest left edge (px, in the part's offset parent) where the part clears every control, as clear as the gap allows (8, 4, then 1 px). */
    const freeX = (p: HTMLElement | SVGElement): number | null => {
      const c = p.getBoundingClientRect(), bounds = bar!.getBoundingClientRect(), parent = containingBlock(p)?.getBoundingClientRect();
      if (!parent) return null;
      for (const gap of [8, 4, 1]) {
        const block = controls.filter((k) => k.b > c.top && k.t < Math.min(c.bottom, bounds.bottom)).map((k) => [k.l - gap, k.r + gap]).sort((a, b) => a[0] - b[0]);
        const free: number[][] = [];
        let x = bounds.left;
        for (const [a, b] of block) { if (a > x) free.push([x, a]); x = Math.max(x, b); }
        if (bounds.right > x) free.push([x, bounds.right]);
        const spots = free.filter(([a, b]) => b - a >= c.width).map(([a, b]) => Math.min(Math.max(c.left, a), b - c.width)).sort((u, v) => Math.abs(u - c.left) - Math.abs(v - c.left));
        if (spots.length) return spots[0] - parent.left;
      }
      return null;
    };
    for (const p of parts) {
      const move = !!movable && p.matches(movable);
      // measured where its own CSS puts it, before any move
      if (move) p.style.removeProperty('--clear-x');
      let under = judge(p);
      if (under && move) {
        const x = freeX(p);
        if (x !== null) { p.style.setProperty('--clear-x', `${x}px`); under = judge(p); }
      }
      p.toggleAttribute('data-hidden', under);
    }
  };
  const later = () => {
    if (disposed) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(check);
  };

  onMounted(() => {
    const bar = root.value?.closest('[data-testid="top-bar"]');
    if (!bar || typeof ResizeObserver === 'undefined') return;
    // the controls move when the bar's width or a control's size changes (a longer title, a widget that appears)
    resize = new ResizeObserver(later);
    resize.observe(bar);
    bar.querySelectorAll(':scope > .content > * > *').forEach((c) => resize?.observe(c));
    mutate = new MutationObserver(later);
    mutate.observe(bar.querySelector(':scope > .content') ?? bar, { childList: true, subtree: true, characterData: true });
    later();
  });
  onScopeDispose(() => {
    disposed = true;
    cancelAnimationFrame(frame);
    resize?.disconnect();
    mutate?.disconnect();
  });
  return later;
}
