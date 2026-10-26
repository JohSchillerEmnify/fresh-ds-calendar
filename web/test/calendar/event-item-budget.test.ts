/** EventItem's line budget follows the page's entry style live, without a resize (review follow-up, feature event-display). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import EventItem from '@/features/calendar/EventItem.vue';
import { itemSegments } from '@/lib/items';
import { entryStyle } from '@/theme/entryStyle';
import { freshPinia } from '../helpers';
import { ev, t } from './helpers';

/** A ResizeObserver that reports every observed element as `width` px wide (border box), once, on observe. */
function stubResizeObserver(width: number) {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: ResizeObserverCallback) {}
    observe(target: Element) {
      const size = [{ inlineSize: width, blockSize: 40 }];
      this.cb([{ target, borderBoxSize: size, contentBoxSize: size, devicePixelContentBoxSize: size, contentRect: { width, height: 40 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  });
}

describe('EventItem line budget', () => {
  beforeEach(() => { freshPinia(); entryStyle.value = 'solid'; });
  afterEach(() => { vi.unstubAllGlobals(); entryStyle.value = 'solid'; });

  it('re-wraps when the entry style changes, with no resize: the border is part of the width the title has', async () => {
    // 120 px block: solid leaves 109 px of content (14 characters a line), outline 105 px (13): a 14-letter title wraps
    stubResizeObserver(120);
    const seg = itemSegments(ev('a', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { title: 'Abcdefghijklmn' }))[0];
    const w = mount(EventItem, { props: { segment: seg, variant: 'block', height: 40 } });
    await flushPromises();
    const chip = () => w.get('[data-testid="event-chip"]').element as HTMLElement;
    expect(chip().style.getPropertyValue('--lines')).toBe('1');
    expect(w.find('[data-testid="event-chip-time"]').exists()).toBe(true);
    entryStyle.value = 'outline';
    await flushPromises();
    expect(chip().style.getPropertyValue('--lines')).toBe('2');
    expect(w.find('[data-testid="event-chip-time"]').exists()).toBe(false);
    w.unmount();
  });
});
