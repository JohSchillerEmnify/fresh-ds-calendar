import type { TaskTemplate, TaskTemplateInput } from '../api/types.js';
import { ApiException, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

/** The template is not one of the person's (unknown, deleted, or another person's). */
export const templateNotFound = (): ApiException => new ApiException('NOT_FOUND', 404, 'Template not found', undefined, 'tasks.templates.notFound');

/** Whether a stored entry has the shape of a template (a hand-edited or damaged file may hold anything). */
function isTemplate(x: unknown): x is TaskTemplate {
  const t = x as Partial<TaskTemplate> | null;
  return typeof t === 'object' && t !== null && typeof t.id === 'string' && typeof t.name === 'string'
    && Array.isArray(t.items) && t.items.every((i) => typeof i === 'object' && i !== null && typeof i.title === 'string')
    && (t.estimateMinutes === null || typeof t.estimateMinutes === 'number')
    && (t.categoryId === null || typeof t.categoryId === 'string');
}

/** How many templates one person may keep. */
export const MAX_TEMPLATES = 100;

interface TemplateDoc { version: 1; templates: TaskTemplate[] }

/** Compares names the way a person reads them: ignoring case, accents and surrounding spaces. */
const sameName = (a: string, b: string): boolean => a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' }) === 0;

/**
 * A person's task list templates, one JSON document in `DATA_DIR/users/<sub>/templates.json` (feature
 * tasklist-templates). Like the Canvas areas it lives on the app server, not in Google, and is backed up to the
 * person's Drive with the rest of their folder (ADR 0010).
 */
export class TemplateStore {
  private readonly files: PersonJsonStore<TemplateDoc>;

  constructor(dataDir: string, log: (m: string) => void = (m) => console.warn(m)) {
    // an entry of the wrong shape is left out; a file without a templates list is set aside
    this.files = new PersonJsonStore<TemplateDoc>(dataDir, 'templates.json',
      (r) => (isRecord(r) && Array.isArray(r.templates) ? { version: 1, templates: r.templates.filter(isTemplate) } : null),
      () => ({ version: 1, templates: [] }), (m) => log(`templates: ${m}`));
  }

  private read(sub: string): TaskTemplate[] {
    return this.files.read(sub).templates;
  }

  private write(sub: string, templates: TaskTemplate[]): void {
    this.files.write(sub, { version: 1, templates });
  }

  /** The person's templates, sorted by name. */
  list(sub: string): TaskTemplate[] {
    return this.read(sub).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  /** Saves a new template (input already validated); refuses a taken name or one template too many. */
  add(sub: string, input: TaskTemplateInput): TaskTemplate {
    const all = this.read(sub);
    if (all.length >= MAX_TEMPLATES) throw validation(`At most ${MAX_TEMPLATES} templates`, undefined, 'tasks.templates.tooMany');
    this.checkName(all, input.name, null);
    const t = this.shape(nanoid(12), input);
    this.write(sub, [...all, t]);
    return t;
  }

  /** Replaces one template whole; its own name stays free for it. */
  replace(sub: string, id: string, input: TaskTemplateInput): TaskTemplate {
    const all = this.read(sub);
    const i = all.findIndex((x) => x.id === id);
    if (i < 0) throw templateNotFound();
    this.checkName(all, input.name, id);
    const t = this.shape(id, input);
    all[i] = t;
    this.write(sub, all);
    return t;
  }

  /** Removes one template; false when there was none with that id. */
  remove(sub: string, id: string): boolean {
    const all = this.read(sub);
    const rest = all.filter((x) => x.id !== id);
    if (rest.length === all.length) return false;
    this.write(sub, rest);
    return true;
  }

  /** Forgets every person's templates (test reset). */
  reset(): void {
    this.files.reset();
  }

  private checkName(all: TaskTemplate[], name: string, self: string | null): void {
    if (all.some((x) => x.id !== self && sameName(x.name, name))) {
      throw validation('A template with this name already exists', 'name', 'tasks.templates.nameTaken');
    }
  }

  private shape(id: string, input: TaskTemplateInput): TaskTemplate {
    return {
      id,
      name: input.name.trim(),
      // a template never keeps a tick, and an empty line is no item
      items: input.items.map((it) => ({ title: it.title.trim(), ...(it.strokes ? { strokes: it.strokes } : {}) })).filter((it) => it.title.length > 0 || it.strokes),
      estimateMinutes: input.estimateMinutes ?? null,
      categoryId: input.categoryId ?? null,
    };
  }
}
