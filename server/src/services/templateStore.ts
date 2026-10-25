import fs from 'node:fs';
import path from 'node:path';
import type { TaskTemplate, TaskTemplateInput } from '../api/types.js';
import { listUserSubs, userDir } from '../auth/people.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { notFound, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';

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
  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'templates.json');
  }

  private read(sub: string): TaskTemplate[] {
    const d = readJson<Partial<TemplateDoc>>(this.file(sub));
    return Array.isArray(d?.templates) ? d.templates : [];
  }

  private write(sub: string, templates: TaskTemplate[]): void {
    writeJsonAtomic(this.file(sub), { version: 1, templates } satisfies TemplateDoc);
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
    if (i < 0) throw notFound('Template not found');
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
    for (const u of listUserSubs(this.dataDir)) fs.rmSync(this.file(u), { force: true });
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
      items: input.items.map((it) => ({ title: it.title.trim() })).filter((it) => it.title.length > 0),
      estimateMinutes: input.estimateMinutes ?? null,
      categoryId: input.categoryId ?? null,
    };
  }
}
