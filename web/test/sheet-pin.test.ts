import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';

vi.hoisted(() => {
  // a wide screen: not a phone
  globalThis.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof matchMedia;
});

let top = 120;
Object.defineProperty(HTMLElement.prototype, 'offsetTop', { configurable: true, get: () => top });
const flush = async () => { await nextTick(); await nextTick(); await nextTick(); };
const marginOf = (w: ReturnType<typeof mount>) => (w.get('.panel').element as HTMLElement).style.marginTop;

describe('a writing panel keeps its top', () => {
  afterEach(() => { document.body.innerHTML = ''; top = 120; });

  it('pins the centred top when `wide` turns on after opening', async () => {
    const w = mount(AdaptiveSheet, { props: { open: true, label: 'x', wide: false }, attachTo: document.body });
    await flush();
    expect(marginOf(w)).toBe('');
    await w.setProps({ wide: true });
    await flush();
    expect(marginOf(w)).toBe('120px');
    await w.setProps({ wide: false });
    await flush();
    expect(marginOf(w)).toBe('');
  });

  it('is pinned again from a fresh measure when the window is resized, and cleared when closed', async () => {
    const w = mount(AdaptiveSheet, { props: { open: true, label: 'x', wide: true }, attachTo: document.body });
    await flush();
    expect(marginOf(w)).toBe('120px');
    top = 200;
    window.dispatchEvent(new Event('resize'));
    await flush();
    expect(marginOf(w)).toBe('200px');
    await w.setProps({ open: false });
    await flush();
    await w.setProps({ open: true });
    top = 90;
    await flush();
    expect(marginOf(w)).toBe('90px');
  });
});
