import { describe, expect, it } from 'vitest';
import { useInkForm } from '../src/features/tasklists/useInkForm';

const s = (n: number) => ({ p: [[n, 0, 1]] as [number, number, number][] });

describe('useInkForm', () => {
  it('always offers ruled lines and an empty one to write on', () => {
    const f = useInkForm();
    expect(f.shown.value).toHaveLength(4);
    f.change(0, [s(1)]);
    f.change(3, [s(2)]);
    expect(f.shown.value).toHaveLength(5);
    expect(f.shown.value.at(-1)).toEqual([]);
  });
  it('turns every written line into one item and undoes the last stroke of the last written line', () => {
    const f = useInkForm();
    f.change(0, [s(1)]);
    f.change(1, [s(2)]);
    f.change(0, [s(1), s(3)]);
    expect(f.written.value).toEqual([[s(1), s(3)], [s(2)]]);
    f.undo();
    expect(f.written.value).toEqual([[s(1)], [s(2)]]);
    f.undo();
    f.undo();
    expect(f.written.value).toEqual([]);
    expect(f.canUndo.value).toBe(false);
  });
});

describe('templates with ink', () => {
  it('keeps the ink items of a list and brings them back as lines', async () => {
    const { templateFromList, inkLinesOf } = await import('../src/features/tasklists/templates');
    const l = { estimateMinutes: null, categoryId: null, items: [{ id: 'a', title: 'Text', done: false }, { id: 'b', title: '', done: false, ink: true as const }] };
    const tpl = templateFromList(l, 'Shop', false, (id) => (id === 'b' ? [s(1)] : []));
    expect(tpl.items).toEqual([{ title: 'Text' }, { title: '', strokes: [s(1)] }]);
    expect(inkLinesOf({ id: 't', ...tpl, estimateMinutes: null, categoryId: null })).toEqual([[s(1)]]);
  });
});
