/**
 * Pure rules of task list templates (feature tasklist-templates): what a template keeps of a list or of a new list's
 * form, how a template fills the new list form, its details line in the picker and the name check. No store or DOM
 * access, so they are unit-tested with fixed data.
 */
import type { TaskList, TaskTemplate, TaskTemplateInput } from '@/api/types';
import { t } from '@/i18n';
import { parseItems, type TaskListForm } from './validate';

/** The longest template name (the server's limit). */
export const NAME_MAX = 80;

/**
 * What a list keeps as a template: its item titles in order (never a tick), estimate and category; never a date,
 * time, repeat, reminders, tags or sharing (owner, 2026-10-25).
 */
export function templateFromList(l: Pick<TaskList, 'items' | 'estimateMinutes' | 'categoryId'>, name: string, categoriesOn: boolean): TaskTemplateInput {
  return {
    name: name.trim(),
    items: l.items.map((i) => ({ title: i.title })),
    estimateMinutes: l.estimateMinutes ?? null,
    categoryId: categoriesOn ? l.categoryId ?? null : null,
  };
}

/** What a new list's form keeps as a template ("Also save as template"): named by the list's title. */
export function templateFromForm(f: TaskListForm, categoriesOn: boolean): TaskTemplateInput {
  return {
    name: f.title.trim(),
    items: parseItems(f.items).map((title) => ({ title })),
    estimateMinutes: f.estimate.trim() ? Number(f.estimate) : null,
    categoryId: categoriesOn && f.categoryId !== 'none' ? f.categoryId : null,
  };
}

/**
 * The new list form filled from a template: title, items, estimate and category. Date, time, repeat and reminders stay
 * as the dialog was opened. A category that no longer exists fills "No category".
 */
export function fillFromTemplate(f: TaskListForm, tpl: TaskTemplate, categoryExists: (id: string) => boolean): TaskListForm {
  return {
    ...f,
    title: tpl.name,
    items: tpl.items.map((i) => i.title).join('\n'),
    estimate: tpl.estimateMinutes ? String(tpl.estimateMinutes) : '',
    categoryId: tpl.categoryId && categoryExists(tpl.categoryId) ? tpl.categoryId : 'none',
  };
}

/** The picker's line under a template's name: "2 items · ~45 min · Home" (estimate and category only when set). */
export function templateDetails(
  tpl: Pick<TaskTemplate, 'items' | 'estimateMinutes'>,
  categoryName: string | null,
  words: { items: (n: number) => string; estimate: (min: number) => string },
): string {
  return [words.items(tpl.items.length), tpl.estimateMinutes ? words.estimate(tpl.estimateMinutes) : null, categoryName]
    .filter((p): p is string => !!p)
    .join(' · ');
}

/** Whether another template already has this name (ignoring case, accents and surrounding spaces, as the server does). */
export function nameTaken(all: Pick<TaskTemplate, 'id' | 'name'>[], name: string, self?: string): boolean {
  const n = name.trim();
  return all.some((x) => x.id !== self && x.name.trim().localeCompare(n, undefined, { sensitivity: 'base' }) === 0);
}

/** The first problem with a template name as a sentence, or '' when it can be saved (required, at most 80, free). */
export function templateNameProblem(all: Pick<TaskTemplate, 'id' | 'name'>[], name: string, self?: string): string {
  if (!name.trim()) return t('tasks.templates.nameRequired');
  if (name.trim().length > NAME_MAX) return t('tasks.templates.nameTooLong');
  return nameTaken(all, name, self) ? t('tasks.templates.nameTaken') : '';
}
