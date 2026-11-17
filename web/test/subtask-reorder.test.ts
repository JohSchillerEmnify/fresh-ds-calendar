import { describe, expect, it } from 'vitest';
import { applyPlacement, placeBlock } from '@/features/tasklists/reorder';

const mk = (spec: string) => spec.split(' ').map((s) => { const [id, l] = s.split(':'); return { id: id!, ...(l ? { level: Number(l) } : {}) }; });
const move = (items: ReturnType<typeof mk>, id: string, to: number, wanted: number) => {
  const p = placeBlock(items, id, to, wanted);
  if (!p) return null;
  const r = applyPlacement(items, id, p);
  return r.ids.map((x, n) => `${x}:${r.levels[n]}`).join(' ');
};

describe('placeBlock', () => {
  const flat = mk('Tent Pegs Poles Food');
  it('a drop in place with one step to the right nests under the item above', () => {
    expect(move(flat, 'Pegs', 1, 1)).toBe('Tent:0 Pegs:1 Poles:0 Food:0');
  });
  it('the first item stays a task', () => {
    expect(move(flat, 'Tent', 0, 1)).toBe('Tent:0 Pegs:0 Poles:0 Food:0');
  });
  it('at most one level deeper than the item above', () => {
    expect(move(flat, 'Poles', 2, 2)).toBe('Tent:0 Pegs:0 Poles:1 Food:0');
  });
  it('three levels are the most', () => {
    expect(move(mk('Tent Pegs:1 Poles:2 Food'), 'Food', 3, 3)).toBe('Tent:0 Pegs:1 Poles:2 Food:2');
  });
  it('one step to the left moves a subtask up and takes its own subtasks along', () => {
    expect(move(mk('Tent Pegs:1 Poles:2 Food'), 'Pegs', 1, 0)).toBe('Tent:0 Pegs:0 Poles:1 Food:0');
  });
  it('a task moves together with its subtasks', () => {
    expect(move(mk('Tent Pegs:1 Poles Food'), 'Tent', 3, 0)).toBe('Poles:0 Food:0 Tent:0 Pegs:1');
    expect(move(mk('A B Tent Pegs:1'), 'Tent', 0, 0)).toBe('Tent:0 Pegs:1 A:0 B:0');
  });
  it('a block keeps within three levels', () => {
    expect(move(mk('A B Tent Pegs:1'), 'Tent', 2, 2)).toBe('A:0 B:0 Tent:1 Pegs:2');
    expect(move(mk('A B Tent Pegs:1 Poles:2'), 'Tent', 2, 2)).toBe('A:0 B:0 Tent:0 Pegs:1 Poles:2');
  });
  it('below a task at its level or higher lands after its subtasks, deeper becomes its first subtask', () => {
    const items = mk('A A1:1 B Food');
    expect(move(items, 'Food', 0, 0)).toBe('Food:0 A:0 A1:1 B:0');
    expect(move(mk('Food A A1:1 B'), 'Food', 1, 0)).toBe('A:0 A1:1 Food:0 B:0');
    expect(move(mk('Food A A1:1 B'), 'Food', 1, 1)).toBe('A:0 Food:1 A1:1 B:0');
  });
  it('unknown id', () => { expect(placeBlock(flat, 'nope', 0, 0)).toBeNull(); });
});
