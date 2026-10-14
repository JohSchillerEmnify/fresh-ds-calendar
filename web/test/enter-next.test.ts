import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { enterNext } from '@/composables/useEnterNext';

const Form = defineComponent({
  setup: () => () => h('form', { onKeydown: enterNext, onSubmit: (e: Event) => { e.preventDefault(); submitted.count++; } }, [
    h('input', { id: 'a', type: 'text' }),
    h('input', { id: 'box', type: 'checkbox' }),
    h('input', { id: 'b', type: 'time', disabled: true }),
    h('input', { id: 'c', type: 'date' }),
    h('textarea', { id: 'd' }),
  ]),
});
const submitted = { count: 0 };

function press(el: Element, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(e);
  return e;
}

describe('enterNext', () => {
  it('moves focus to the next enabled text-like field, skipping checkboxes and disabled fields, and never submits', () => {
    const w = mount(Form, { attachTo: document.body });
    const a = w.get('#a').element as HTMLInputElement;
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    a.focus();
    expect(press(a).defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('c');
    press(document.activeElement!, { ctrlKey: true });
    expect(document.activeElement?.id).toBe('d');
    expect(submitted.count).toBe(0);
    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
    w.unmount();
  });

  it('keeps Enter as a newline in a textarea', () => {
    const w = mount(Form, { attachTo: document.body });
    const d = w.get('#d').element as HTMLTextAreaElement;
    d.focus();
    expect(press(d).defaultPrevented).toBe(false);
    expect(document.activeElement?.id).toBe('d');
    w.unmount();
  });

  it('blurs the last single-line field when nothing follows', () => {
    const Last = defineComponent({ setup: () => () => h('form', { onKeydown: enterNext }, [h('input', { id: 'only', type: 'text' })]) });
    const w = mount(Last, { attachTo: document.body });
    const el = w.get('#only').element as HTMLInputElement;
    el.focus();
    press(el);
    expect(document.activeElement).toBe(document.body);
    w.unmount();
  });
});
