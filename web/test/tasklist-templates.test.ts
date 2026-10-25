/** Pure rules of task list templates (feature tasklist-templates): what a template keeps, how it fills the form, its details line. */
import { describe, expect, it } from 'vitest';
import type { TaskList, TaskTemplate } from '@/api/types';
import { newTaskListForm } from '@/features/tasklists/validate';
import { fillFromTemplate, nameTaken, templateDetails, templateFromForm, templateFromList, templateNameProblem } from '@/features/tasklists/templates';

const list = (over: Partial<TaskList> = {}): TaskList => ({
  kind: 'tasklist', id: 'l1', calendarId: 'c', title: 'Clean bathroom', date: '2026-10-14', time: '18:00',
  items: [{ id: 'a', title: 'Sink', done: true }, { id: 'b', title: 'Floor', done: false }], doneCount: 1, totalCount: 2,
  estimateMinutes: 45, recurrence: 'weekly', categoryId: 'home', tags: ['door'], color: '#f00', calendarColor: '#00f',
  completedOn: null, canvas: null, etag: 'e', updated: '', ...over,
} as TaskList);
const tpl = (over: Partial<TaskTemplate> = {}): TaskTemplate => ({ id: 't1', name: 'Packing', items: [{ title: 'Passport' }, { title: 'Charger' }], estimateMinutes: null, categoryId: null, ...over });

describe('templateFromList', () => {
  it('keeps the title as name, the item titles in order, the estimate and the category; never ticks, date, time, repeat or tags', () => {
    expect(templateFromList(list(), 'Bath', true)).toEqual({ name: 'Bath', items: [{ title: 'Sink' }, { title: 'Floor' }], estimateMinutes: 45, categoryId: 'home' });
  });
  it('keeps no category while task categories are off', () => {
    expect(templateFromList(list(), 'Bath', false).categoryId).toBeNull();
  });
});

describe('templateFromForm', () => {
  it('takes the title, the item lines, the estimate and the category of a new list form', () => {
    const f = { ...newTaskListForm('2026-10-14'), title: ' Weekly shop ', items: 'Milk\n\n Eggs ', estimate: '30', categoryId: 'shopping' };
    expect(templateFromForm(f, true)).toEqual({ name: 'Weekly shop', items: [{ title: 'Milk' }, { title: 'Eggs' }], estimateMinutes: 30, categoryId: 'shopping' });
    expect(templateFromForm({ ...f, estimate: '', categoryId: 'none' }, true)).toMatchObject({ estimateMinutes: null, categoryId: null });
  });
});

describe('fillFromTemplate', () => {
  it('fills title, items, estimate and category and leaves date, time, repeat and reminders as they were', () => {
    const f = { ...newTaskListForm('2026-10-14', '15:00'), repeat: 'weekly' as const };
    const out = fillFromTemplate(f, tpl({ estimateMinutes: 45, categoryId: 'home' }), (id) => id === 'home');
    expect(out).toMatchObject({ title: 'Packing', items: 'Passport\nCharger', estimate: '45', categoryId: 'home', date: '2026-10-14', time: '15:00', repeat: 'weekly' });
  });
  it('fills "No category" for a category that no longer exists, and no estimate when the template has none', () => {
    const out = fillFromTemplate(newTaskListForm('2026-10-14'), tpl({ categoryId: 'gone' }), () => false);
    expect(out).toMatchObject({ categoryId: 'none', estimate: '' });
  });
});

describe('templateDetails', () => {
  const words = { items: (n: number) => (n === 1 ? '1 item' : `${n} items`), estimate: (m: number) => `~${m} min` };
  it('says the item count, then the estimate and the category when there are', () => {
    expect(templateDetails(tpl(), null, words)).toBe('2 items');
    expect(templateDetails(tpl({ items: [{ title: 'x' }], estimateMinutes: 45 }), 'Home', words)).toBe('1 item · ~45 min · Home');
  });
});

describe('nameTaken', () => {
  it('compares names ignoring case, accents and spaces, and lets a template keep its own name', () => {
    const all = [tpl(), tpl({ id: 't2', name: 'Café' })];
    expect(nameTaken(all, ' packing ')).toBe(true);
    expect(nameTaken(all, 'cafe')).toBe(true);
    expect(nameTaken(all, 'Packing', 't1')).toBe(false);
    expect(nameTaken(all, 'City trip')).toBe(false);
  });
});

describe('templateNameProblem', () => {
  it('asks for a name, refuses more than 80 characters and a taken name, and accepts a free one', () => {
    const all = [tpl()];
    expect(templateNameProblem(all, '  ')).toBe('Give the template a name');
    expect(templateNameProblem(all, 'x'.repeat(81))).toBe('The template name can be at most 80 characters');
    expect(templateNameProblem(all, 'x'.repeat(80))).toBe('');
    expect(templateNameProblem(all, 'packing')).toBe('A template with this name already exists');
    expect(templateNameProblem(all, 'Packing', 't1')).toBe('');
  });
});
