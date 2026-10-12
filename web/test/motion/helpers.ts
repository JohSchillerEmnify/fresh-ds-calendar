import { vi } from 'vitest';

/** Mock WAAPI: animate() returns a controllable Animation-like object; finish with finishAll(). */
export const mockAnims: { el: Element; frames: unknown; opts: unknown; finish: () => void; cancel: () => void; playState: string }[] = [];

export function installWaapi() {
  mockAnims.length = 0;
  (Element.prototype as unknown as { animate: unknown }).animate = function (this: Element, frames: unknown, opts: unknown) {
    let res!: () => void;
    const finished = new Promise<void>((r) => (res = r));
    const a = {
      el: this, frames, opts, playState: 'running', finished,
      finish() { a.playState = 'finished'; res(); },
      cancel() { a.playState = 'idle'; res(); },
    };
    mockAnims.push(a);
    return a;
  };
}
export function removeWaapi() {
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
}
export function finishAll() {
  mockAnims.forEach((a) => a.finish());
}

export function pe(type: string, init: Partial<PointerEventInit> & { x?: number; y?: number } = {}) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.x ?? init.clientX ?? 0, clientY: init.y ?? init.clientY ?? 0, button: init.button ?? 0 });
  Object.assign(ev, { pointerId: init.pointerId ?? 1, pointerType: init.pointerType ?? 'mouse', isPrimary: true });
  return ev;
}
export const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
export { vi };
