/** Types shared by the drag controller, the hit-test grids and the drag watch. */

export type DragState = 'idle' | 'pending' | 'dragging' | 'dropping' | 'returning';

export interface DragContext {
  /** Element rect at pick-up. */
  originRect: DOMRect;
  /** Pointer offset inside the element at pick-up. */
  grab: Point;
}
export interface Point { x: number; y: number }

/** Result of a hit test. dx/dy (optional) = translation from the origin that lands the card on the snapped cell/slot. */
export interface DropTarget<K = unknown> {
  key: K;
  dx?: number;
  dy?: number;
}

export interface DragOptions<K = unknown> {
  /** Pointer position (client px) -> snapped target, or null when not over a valid target. */
  hitTest: (x: number, y: number, ctx: DragContext) => DropTarget<K> | null;
  /** Called on drop over a valid target. Reject to spring back. */
  onDrop: (target: DropTarget<K>) => void | Promise<unknown>;
  /** Long-press (touch, pen, and a mouse held still) in ms (default 350). */
  touchDelay?: number;
  /** Touch movement that cancels the long-press (default 8 px). */
  touchSlop?: number;
  /** Mouse movement that starts the drag (default 4 px). */
  mouseSlop?: number;
  /** If true (default) the card follows the snapped slot (magnet) when the target has dx/dy. */
  magnet?: boolean;
  /** true (default): onDrop is called immediately and the transform cleared (the consumer applies an optimistic move). */
  optimistic?: boolean;
  disabled?: () => boolean;
  /** Scale of the element's ancestors (a zoomed Canvas): a translate of 1 px moves it by this many screen px. Read at pick-up; default 1. */
  scale?: () => number;
  onStateChange?: (s: DragState) => void;
  onTarget?: (t: DropTarget<K> | null) => void;
  /**
   * Scroll container auto-scrolled near its edges while dragging. Any scroll of it (auto-scroll or wheel) re-runs the hit
   * test, and when it contains the card the card's transform compensates, so the card stays under the pointer.
   */
  scrollEl?: () => HTMLElement | null;
}
