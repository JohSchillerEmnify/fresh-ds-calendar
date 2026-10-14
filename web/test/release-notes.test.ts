/** What's new: which notes a device has not seen yet. */
import { describe, expect, it } from 'vitest';
import { unseenNotes } from '@/pwa/releaseNotes';

const notes = [{ id: 'c', date: '2026-10-14', text: 'C' }, { id: 'b', date: '2026-10-14', text: 'B' }, { id: 'a', date: '2026-10-13', text: 'A' }];

describe('unseenNotes', () => {
  it('returns the notes newer than the seen one', () => {
    expect(unseenNotes(notes, 'a').map((n) => n.id)).toEqual(['c', 'b']);
    expect(unseenNotes(notes, 'c')).toEqual([]);
  });
  it('returns all notes when nothing, or an unknown note, was seen', () => {
    expect(unseenNotes(notes, null)).toHaveLength(3);
    expect(unseenNotes(notes, 'gone')).toHaveLength(3);
  });
});
