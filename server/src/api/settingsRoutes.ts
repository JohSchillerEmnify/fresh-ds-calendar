import { nearestGoogleColorId } from '@calendar/shared/colors';
import type { Category } from './types.js';
import { notFound, preconditionFailed, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { categoryCreateSchema, categoryOrderSchema, categoryPatchSchema, parse, settingsPatchSchema } from '../lib/validation.js';
import { withGoogleColor } from '../services/settingsStore.js';
import { body, type RouteDeps } from './routeHelpers.js';

/** Registers the per-person settings and categories. */
export function registerSettings({ r, ctx, person }: RouteDeps): void {
  const { settings } = ctx;
  r.get('/settings', (c) => c.json(settings.get(person(c))));
  r.patch('/settings', async (c) => {
    // an app not yet updated may still send the retired `defaultEventColorId`: dropped, so its other settings still save
    const raw = await body(c);
    const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
    const rest = isObject ? { ...(raw as Record<string, unknown>) } : raw;
    if (isObject) delete (rest as Record<string, unknown>).defaultEventColorId;
    const patch = parse(settingsPatchSchema, rest);
    const im = c.req.header('If-Match');
    if (im !== undefined && String(settings.get(person(c)).version) !== im.replaceAll('"', '').trim()) throw preconditionFailed('Settings were changed elsewhere. Reload and try again.');
    return c.json(
      settings.update(person(c), (d) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) continue;
          (d as unknown as Record<string, unknown>)[k] = k === 'seedColor' ? (v as string).toLowerCase() : v;
        }
      }),
    );
  });

  const uniqueName = (cats: Category[], name: string, exceptId?: string) => {
    if (cats.some((x) => x.id !== exceptId && x.name.toLowerCase() === name.toLowerCase())) {
      throw validation('A category with this name already exists', 'name', 'category.nameExists');
    }
  };

  r.post('/categories', async (c) => {
    const b = parse(categoryCreateSchema, await body(c));
    uniqueName(settings.categories(person(c)), b.name);
    return c.json(
      settings.update(person(c), (d) => {
        d.categories.push(withGoogleColor({ id: nanoid(), name: b.name, color: b.color.toLowerCase(), icon: b.icon ?? null }));
      }),
      201,
    );
  });
  r.put('/categories/order', async (c) => {
    const { categoryIds } = parse(categoryOrderSchema, await body(c));
    const cur = settings.categories(person(c));
    if (categoryIds.length !== cur.length || new Set(categoryIds).size !== cur.length || categoryIds.some((i) => !cur.some((x) => x.id === i))) {
      throw validation('categoryIds must contain every category id exactly once', 'categoryIds');
    }
    return c.json(settings.update(person(c), (d) => { d.categories = categoryIds.map((i) => d.categories.find((x) => x.id === i)!); }));
  });
  r.patch('/categories/:id', async (c) => {
    const id = c.req.param('id');
    const b = parse(categoryPatchSchema, await body(c));
    if (!settings.categories(person(c)).some((x) => x.id === id)) throw notFound('Category not found');
    if (b.name !== undefined) uniqueName(settings.categories(person(c)), b.name, id);
    const saved = settings.update(person(c), (d) => {
      const cat = d.categories.find((x) => x.id === id)!;
      if (b.name !== undefined) cat.name = b.name;
      if (b.color !== undefined) { cat.color = b.color.toLowerCase(); cat.googleColorId = nearestGoogleColorId(cat.color); }
      if (b.icon !== undefined) cat.icon = b.icon;
    });
    // people this category's lists are shared with see the new look
    const now = saved.categories.find((x) => x.id === id)!;
    ctx.shared.refreshCategory(person(c), id, { name: now.name, color: now.color, icon: now.icon });
    return c.json(saved);
  });
  r.delete('/categories/:id', (c) => {
    const id = c.req.param('id');
    if (!settings.categories(person(c)).some((x) => x.id === id)) throw notFound('Category not found');
    ctx.shared.refreshCategory(person(c), id, null);
    return c.json(settings.update(person(c), (d) => { d.categories = d.categories.filter((x) => x.id !== id); }));
  });
}
