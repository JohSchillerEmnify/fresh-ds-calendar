import { MAX_THEME_BYTES, sanitizePicture, validatePicture, validateTheme, type ThemePicture } from '@calendar/shared';
import type { Ctx } from '../context.js';
import { ApiException, notFound } from '../lib/errors.js';
import { loadSvgSanitizer } from '../lib/svg.js';
import { parse, themePatchSchema } from '../lib/validation.js';
import { themeFitsSize } from '../services/themeStore.js';
import { body, type RouteDeps } from './routeHelpers.js';

/** The theme readers `GET /api/changes` shares with the theme routes. */
export function themeReaders(ctx: Ctx) {
  const themeOf = (sub: string) => {
    ctx.prefs.migrateScene(sub, ctx.settings.legacyTopBarScene(sub));
    ctx.prefs.migrateGarden(sub, ctx.settings.legacyGarden(sub));
    return ctx.prefs.theme(sub);
  };
  const themesOf = (sub: string) => ({ themes: ctx.themes.list(sub).map(({ id, doc, picture }) => ({ id, doc, ...(picture ? { picture } : {}) })) });
  return { themeOf, themesOf };
}

/** Registers the per-person theme and the imported themes. */
export function registerThemes({ r, ctx, person }: RouteDeps, { themeOf, themesOf }: ReturnType<typeof themeReaders>): void {
  r.get('/prefs/theme', (c) => c.json(themeOf(person(c))));
  r.patch('/prefs/theme', async (c) => c.json(ctx.prefs.setTheme(person(c), parse(themePatchSchema, await body(c)))));

  // ---- imported themes ----
  r.get('/themes', (c) => c.json(themesOf(person(c))));
  r.post('/themes', async (c) => {
    const b = await body(c);
    const fail = (errors: string[]) => new ApiException('VALIDATION_ERROR', 400, errors[0]!, errors.map((issue) => ({ issue })));
    if (typeof b !== 'object' || b === null || Array.isArray(b)) throw fail(['Request body must be a JSON object']);
    const unknown = Object.keys(b).filter((k) => k !== 'theme' && k !== 'picture');
    if (unknown.length) throw fail(unknown.map((k) => `${k} is not a known field`));
    const { theme, picture } = b as { theme?: unknown; picture?: unknown };
    const doc = validateTheme(theme);
    if (!doc.ok) throw fail(doc.errors);
    if (!themeFitsSize(theme)) throw fail([`The theme must be at most ${MAX_THEME_BYTES / 1024} KB`]);
    let clean: ThemePicture | undefined;
    let removed = false;
    if (picture !== undefined) {
      const valid = validatePicture(picture);
      if (!valid.ok) throw fail(valid.errors);
      // the sanitiser (jsdom) is only loaded for a theme that brings a picture
      const safe = sanitizePicture(await loadSvgSanitizer(), valid.picture);
      if (!safe.ok) throw fail(safe.errors);
      clean = safe.picture;
      removed = safe.removed;
    }
    const saved = ctx.themes.add(person(c), doc.doc, clean);
    return c.json({ id: saved.id, doc: saved.doc, ...(clean ? { picture: clean } : {}), sanitized: removed }, 201);
  });
  r.delete('/themes/:id', (c) => {
    if (!ctx.themes.remove(person(c), c.req.param('id'))) throw notFound('Theme not found');
    return c.body(null, 204);
  });
}
