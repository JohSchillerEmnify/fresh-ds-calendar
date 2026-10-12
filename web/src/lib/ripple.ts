import type { Directive } from 'vue';

interface RippleEl extends HTMLElement {
  __ripple?: () => void;
}

/**
 * `v-ripple`: adds the state-layer class, exposes `data-pressed="true"` while pressed, and spawns one ripple
 * element per press (removed on animationend; hidden by CSS when motion is reduced/off).
 */
export const vRipple: Directive<RippleEl, boolean | undefined> = {
  mounted(el, { value }) {
    if (value === false) return;
    el.classList.add('m3-state');
    const layer = document.createElement('span');
    layer.className = 'm3-layer';
    layer.setAttribute('data-state-layer', '');
    layer.setAttribute('aria-hidden', 'true');
    el.prepend(layer);
    const down = (e: PointerEvent) => {
      el.dataset.pressed = 'true';
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const span = document.createElement('span');
      span.className = 'm3-ripple';
      span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      span.addEventListener('animationend', () => span.remove(), { once: true });
      el.appendChild(span);
    };
    const up = () => { delete el.dataset.pressed; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.__ripple = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', up);
      el.querySelectorAll('.m3-ripple, .m3-layer').forEach((n) => n.remove());
    };
  },
  unmounted(el) {
    el.__ripple?.();
  },
};
